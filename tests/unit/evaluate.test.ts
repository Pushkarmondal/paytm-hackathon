import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import type { CaseInputs, ItemResult, SimulationResult } from "@/engine/types";
import {
  DEMO_ESTIMATE,
  DEMO_RULESET,
  DEMO_RULESET_WITHOUT_DEDUCTION,
  DEMO_SCHEDULE,
  DEMO_SCHEDULE_CONTRADICTORY,
  SCENARIO_DELUXE,
  SCENARIO_SINGLE,
  SCENARIO_TWIN,
  demoInputs,
} from "@/fixtures/demo-policy";

const item = (r: SimulationResult, id: string): ItemResult => {
  const found = r.items.find((i) => i.itemId === id);
  if (!found) throw new Error(`missing item ${id}`);
  return found;
};

describe("evaluate: scenario A, twin-sharing room within the entitlement", () => {
  const r = evaluate(demoInputs(), SCENARIO_TWIN);

  it("recalculates room rent and the scenario total for the selected room", () => {
    expect(r.scenario.ratePerDay).toBe(rupees(4_500));
    expect(r.totals.roomRent).toBe(rupees(18_000));
    expect(r.totals.nonRoomItems).toBe(rupees(293_500));
    expect(r.totals.scenarioTotal).toBe(rupees(311_500));
  });

  it("finds no room excess and no proportionate deduction", () => {
    expect(r.roomExcess.state).toBe("calculated");
    expect(r.roomExcess.value).toBe(0);
    expect(r.deductionRule.applicability).toBe("withinEntitlement");
    expect(r.deductionRule.ratio).toBeNull();
    for (const id of ["nursing", "surgeon", "anaesthetist", "ot"]) {
      expect(item(r, id).deduction.state).toBe("calculated");
      expect(item(r, id).deduction.value).toBe(0);
    }
  });

  it("still applies the ICU limit, which does not depend on the room", () => {
    expect(r.icuExcess.state).toBe("calculated");
    expect(r.icuExcess.value).toBe(rupees(5_000));
    expect(r.icuExcess.trace?.source.clauseId).toBe("C2");
  });

  it("keeps unclassified items out of every total, and separate from zero", () => {
    expect(r.totals.calculatedDeductions).toBe(rupees(5_000));
    expect(r.totals.conditionalDeductions).toBeNull();
    expect(r.totals.unclassifiedAmount).toBe(rupees(7_500));
    expect(r.totals.unclassifiedCount).toBe(2);
    expect(item(r, "physio").deduction.state).toBe("unknown");
    expect(item(r, "physio").deduction.value).toBeNull();
    expect(r.uncertainties.some((u) => u.code === "ITEM_NOT_CLASSIFIED")).toBe(true);
  });

  it("reports the overall state as calculated", () => {
    expect(r.overallState).toBe("calculated");
  });
});

describe("evaluate: scenario B, single private room above the entitlement", () => {
  const r = evaluate(demoInputs(), SCENARIO_SINGLE);

  it("computes the room excess from C1", () => {
    expect(r.totals.roomRent).toBe(rupees(30_000));
    expect(r.totals.scenarioTotal).toBe(rupees(323_500));
    expect(r.roomExcess.value).toBe(rupees(10_000));
  });

  it("treats the deduction as conditional while differential billing is not established", () => {
    expect(r.deductionRule.applicability).toBe("conditional");
    expect(r.deductionRule.ratio).toEqual({ num: 2, den: 3 });
    const surgeon = item(r, "surgeon");
    expect(surgeon.deduction.state).toBe("conditional");
    expect(surgeon.deduction.value).toBeNull();
    expect(surgeon.deduction.range).toEqual({
      low: 0,
      high: rupees(20_000),
      basis: expect.stringContaining("differential billing"),
    });
    expect(surgeon.trace?.source.clauseId).toBe("C3");
    expect(surgeon.trace?.formula).toContain("5,000 ÷ 7,500");
  });

  it("gives the conditional total as a range with both bounds, and lists why", () => {
    expect(r.totals.calculatedDeductions).toBe(rupees(15_000));
    expect(r.totals.conditionalDeductions).toEqual({
      low: 0,
      high: rupees(38_000),
      basis: expect.any(String),
    });
    const u = r.uncertainties.find((x) => x.code === "DIFFERENTIAL_BILLING_NOT_ESTABLISHED");
    expect(u?.amountAtStake).toEqual({ low: 0, high: rupees(38_000), basis: expect.any(String) });
    expect(u?.resolvableBy).toBe("hospital");
    expect(r.overallState).toBe("conditional");
  });

  it("does not deduct from excluded items, and says which clause excludes them", () => {
    for (const id of ["implant", "pharmacy", "diagnostics"]) {
      expect(item(r, id).deduction.state).toBe("excluded");
      expect(item(r, id).deduction.value).toBe(0);
      expect(item(r, id).trace?.source.clauseId).toBe("C4");
    }
    expect(item(r, "icu").deduction.state).toBe("excluded");
  });

  it("flags that the wording is silent on room unavailability as requiring insurer confirmation", () => {
    const u = r.uncertainties.find((x) => x.code === "WORDING_SILENT_ON_ROOM_UNAVAILABILITY");
    expect(u?.resolvableBy).toBe("insurer");
  });

  it("becomes fully calculated once the user confirms differential billing", () => {
    const inputs: CaseInputs = { ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } };
    const c = evaluate(inputs, SCENARIO_SINGLE);
    expect(c.deductionRule.applicability).toBe("applies");
    expect(item(c, "nursing").deduction.value).toBe(133_333);
    expect(item(c, "surgeon").deduction.value).toBe(rupees(20_000));
    expect(item(c, "anaesthetist").deduction.value).toBe(rupees(5_000));
    expect(item(c, "ot").deduction.value).toBe(1_166_667);
    expect(c.totals.calculatedDeductions).toBe(rupees(53_000));
    expect(c.totals.conditionalDeductions).toBeNull();
    expect(c.overallState).toBe("calculated");
    const provenance = item(c, "surgeon").trace?.inputs.find((i) => i.name === "hospitalFollowsDifferentialBilling")?.provenance;
    expect(provenance).toBe("userConfirmed");
  });

  it("applies no deduction when the estimate states the hospital does not bill differentially", () => {
    const inputs: CaseInputs = { ...demoInputs(), estimate: { ...DEMO_ESTIMATE, differentialBilling: "no" } };
    const c = evaluate(inputs, SCENARIO_SINGLE);
    expect(c.deductionRule.applicability).toBe("conditionFailed");
    expect(item(c, "surgeon").deduction.state).toBe("calculated");
    expect(item(c, "surgeon").deduction.value).toBe(0);
    expect(c.totals.calculatedDeductions).toBe(rupees(15_000));
    expect(c.totals.conditionalDeductions).toBeNull();
  });
});

describe("evaluate: scenario B', deluxe room", () => {
  it("recalculates every dependent output at ratio 5/12", () => {
    const inputs: CaseInputs = { ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } };
    const r = evaluate(inputs, SCENARIO_DELUXE);
    expect(r.totals.roomRent).toBe(rupees(48_000));
    expect(r.totals.scenarioTotal).toBe(rupees(341_500));
    expect(r.roomExcess.value).toBe(rupees(28_000));
    expect(r.deductionRule.ratio).toEqual({ num: 5, den: 12 });
    expect(item(r, "ot").deduction.value).toBe(2_041_667);
    expect(r.totals.calculatedDeductions).toBe(rupees(99_500));
  });

  it("honours an edited room rate", () => {
    const r = evaluate(demoInputs(), { ...SCENARIO_SINGLE, roomRatePerDay: rupees(10_000) });
    expect(r.scenario.ratePerDay).toBe(rupees(10_000));
    expect(r.scenario.rateProvenance).toBe("userEntered");
    expect(r.totals.roomRent).toBe(rupees(40_000));
    expect(r.deductionRule.ratio).toEqual({ num: 1, den: 2 });
  });
});

describe("evaluate: refusing to overstate", () => {
  it("applies the proportionate deduction only when the wording has the rule", () => {
    const inputs: CaseInputs = {
      ...demoInputs(),
      ruleset: DEMO_RULESET_WITHOUT_DEDUCTION,
      confirmations: { hospitalFollowsDifferentialBilling: true },
    };
    const r = evaluate(inputs, SCENARIO_SINGLE);
    expect(r.deductionRule.applicability).toBe("ruleAbsent");
    expect(item(r, "surgeon").deduction.value).toBe(0);
    expect(r.roomExcess.value).toBe(rupees(10_000));
    expect(r.totals.calculatedDeductions).toBe(rupees(15_000));
  });

  it("cannot produce a definitive result without the policy schedule", () => {
    const inputs: CaseInputs = { ...demoInputs(), schedule: null };
    const r = evaluate(inputs, SCENARIO_SINGLE);
    expect(r.overallState).toBe("cannotDetermine");
    expect(r.roomLimit.state).toBe("unknown");
    expect(r.roomExcess.value).toBeNull();
    expect(r.icuExcess.value).toBeNull();
    expect(r.deductionRule.applicability).toBe("undetermined");
    expect(item(r, "surgeon").deduction.state).toBe("unknown");
    expect(r.totals.calculatedDeductions).toBe(0);
    expect(r.totals.conditionalDeductions).toBeNull();
    expect(r.uncertainties.some((u) => u.code === "SCHEDULE_MISSING")).toBe(true);
  });

  it("returns review-required when the schedule contradicts the wording", () => {
    const inputs: CaseInputs = { ...demoInputs(), schedule: DEMO_SCHEDULE_CONTRADICTORY };
    const r = evaluate(inputs, SCENARIO_SINGLE);
    expect(r.overallState).toBe("reviewRequired");
    expect(r.roomLimit.state).toBe("reviewRequired");
    expect(r.roomExcess.value).toBeNull();
    expect(r.deductionRule.applicability).toBe("undetermined");
    expect(r.uncertainties.some((u) => u.code === "SCHEDULE_CONTRADICTS_WORDING")).toBe(true);
  });
});

describe("evaluate: provenance, versions and the synthetic label", () => {
  const r = evaluate(demoInputs(), SCENARIO_SINGLE);

  it("embeds the engine and fixture versions", () => {
    expect(r.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.fixtureVersion).toBe(DEMO_RULESET.fixtureVersion);
  });

  it("makes a synthetic policy distinguishable from an insurer-issued one", () => {
    expect(r.policy.issuer.kind).toBe("synthetic");
    if (r.policy.issuer.kind === "synthetic") {
      expect(r.policy.issuer.label).toMatch(/No insurer/);
    }
    const insurerIssued = evaluate(
      {
        ...demoInputs(),
        ruleset: {
          ...DEMO_RULESET,
          metadata: {
            ...DEMO_RULESET.metadata,
            issuer: { kind: "insurer", name: "Example Insurer", sourceUrl: "https://example.invalid/wording.pdf" },
          },
        },
      },
      SCENARIO_SINGLE,
    );
    expect(insurerIssued.policy.issuer.kind).toBe("insurer");
  });

  it("lists what this version does not model", () => {
    expect(r.notModelled.length).toBeGreaterThan(3);
    expect(r.notModelled.join(" ")).toMatch(/co-pay/i);
  });

  it("uses the schedule's own text when the schedule agrees with the wording", () => {
    const names = r.roomLimit.trace?.inputs.map((i) => i.name) ?? [];
    expect(names).toContain("sumInsured");
    expect(r.roomLimit.trace?.assumptions).toEqual([]);
  });

  it("is deterministic", () => {
    expect(evaluate(demoInputs(), SCENARIO_SINGLE)).toEqual(r);
  });

  it("uses the schedule when it is the only source of the limit", () => {
    const ruleset = {
      ...DEMO_RULESET,
      rules: {
        ...DEMO_RULESET.rules,
        roomLimit: { ...DEMO_RULESET.rules.roomLimit!, basis: { kind: "scheduleDefined" as const } },
      },
    };
    const s = evaluate({ ...demoInputs(), ruleset, schedule: DEMO_SCHEDULE }, SCENARIO_SINGLE);
    expect(s.roomLimit.state).toBe("calculated");
    expect(s.roomLimit.eligiblePerDay).toBe(rupees(5_000));
    expect(s.roomLimit.trace?.operation).toBe("limit.scheduleDefined");
  });
});
