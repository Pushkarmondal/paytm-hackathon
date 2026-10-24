import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { resolveLimit } from "@/engine/limits";
import { rupees } from "@/engine/money";
import type { CaseInputs, PolicyRuleset } from "@/engine/types";
import { DEMO_ESTIMATE, DEMO_RULESET, DEMO_SCHEDULE, SCENARIO_DELUXE, SCENARIO_SINGLE, SCENARIO_TWIN, demoInputs, demoSource } from "@/fixtures/demo-policy";

const item = (r: ReturnType<typeof evaluate>, id: string) => r.items.find((i) => i.itemId === id)!;
const confirmed = (ruleset: PolicyRuleset, extra: Partial<CaseInputs> = {}): CaseInputs => ({
  ...demoInputs(),
  ruleset,
  confirmations: { hospitalFollowsDifferentialBilling: true },
  ...extra,
});

describe("capped percent-of-sum-insured limits", () => {
  const capped: PolicyRuleset = {
    ...DEMO_RULESET,
    rules: { ...DEMO_RULESET.rules, roomLimit: { ...DEMO_RULESET.rules.roomLimit!, basis: { kind: "percentOfSumInsuredPerDay", percent: 2, capPerDay: rupees(5_000) } } },
  };

  it("takes the lower of the percentage and the cap", () => {
    const limit = resolveLimit("room", capped, { ...DEMO_SCHEDULE, roomLimitPerDay: undefined });
    expect(limit.state).toBe("calculated");
    expect(limit.eligiblePerDay).toBe(rupees(5_000));
    expect(limit.trace?.formula).toContain("2%");
    expect(limit.trace?.formula).toContain("₹5,000");
    expect(limit.trace?.inputs.map((i) => i.name)).toContain("capPerDay");
  });

  it("uses the percentage when it is below the cap", () => {
    const limit = resolveLimit("room", capped, { ...DEMO_SCHEDULE, sumInsured: rupees(100_000), roomLimitPerDay: undefined });
    expect(limit.eligiblePerDay).toBe(rupees(2_000));
  });
});

describe("the proportionate deduction can be triggered by the ICU rate as well as the room rate", () => {
  const icuTriggered: PolicyRuleset = {
    ...DEMO_RULESET,
    rules: { ...DEMO_RULESET.rules, proportionateDeduction: { ...DEMO_RULESET.rules.proportionateDeduction!, triggers: ["room", "icu"] } },
  };

  it("applies via the ICU ratio when the room is within its limit but the ICU rate is above its limit", () => {
    const r = evaluate(confirmed(icuTriggered), SCENARIO_TWIN);
    expect(r.roomExcess.value).toBe(0);
    expect(r.icuExcess.value).toBe(rupees(5_000));
    expect(r.deductionRule.applicability).toBe("applies");
    expect(r.deductionRule.trigger).toBe("icu");
    expect(r.deductionRule.ratio).toEqual({ num: 2, den: 3 });
    expect(item(r, "surgeon").deduction.value).toBe(rupees(20_000));
    expect(item(r, "surgeon").trace?.inputs.map((i) => i.name)).toContain("icuRatePerDay");
  });

  it("applies with a single ratio when room and ICU exceed their limits in the same proportion", () => {
    const r = evaluate(confirmed(icuTriggered), SCENARIO_SINGLE);
    expect(r.deductionRule.trigger).toBe("both");
    expect(r.deductionRule.applicability).toBe("applies");
    expect(r.deductionRule.ratio).toEqual({ num: 2, den: 3 });
  });

  it("refuses to pick a ratio when room and ICU exceed their limits in different proportions", () => {
    const r = evaluate(confirmed(icuTriggered), SCENARIO_DELUXE);
    expect(r.deductionRule.trigger).toBe("both");
    expect(r.deductionRule.applicability).toBe("conditional");
    expect(r.deductionRule.ratio).toBeNull();
    const surgeon = item(r, "surgeon");
    expect(surgeon.deduction.state).toBe("conditional");
    expect(surgeon.deduction.range).toEqual({ low: rupees(20_000), high: rupees(35_000), basis: expect.stringContaining("ICU") });
    const u = r.uncertainties.find((x) => x.code === "RATIO_AMBIGUOUS_ROOM_AND_ICU");
    expect(u?.resolvableBy).toBe("insurer");
    expect(u?.amountAtStake).toEqual({ low: rupees(38_000), high: rupees(66_500), basis: expect.any(String) });
    expect(r.overallState).toBe("conditional");
  });

  it("does not trigger on the ICU rate when the rule only names the room", () => {
    const r = evaluate(confirmed(DEMO_RULESET), SCENARIO_TWIN);
    expect(r.deductionRule.applicability).toBe("withinEntitlement");
    expect(r.deductionRule.trigger).toBeNull();
  });
});

describe("co-payment on the admissible claim amount", () => {
  const withCopay: PolicyRuleset = {
    ...DEMO_RULESET,
    clauses: [...DEMO_RULESET.clauses, { id: "C6", title: "Co-payment", page: 4, text: "Each and every claim under the Policy shall be subject to a Co-payment of 5% applicable to the claim amount admissible and payable." }],
    rules: { ...DEMO_RULESET.rules, copay: { ruleId: "C6.copay", percent: 5, source: { ...demoSource("C1"), clauseId: "C6", page: 4, quotedText: "Each and every claim under the Policy shall be subject to a Co-payment of 5% applicable to the claim amount admissible and payable." } } },
  };

  it("is absent, with no trace, when the wording has no co-payment clause", () => {
    const r = evaluate(confirmed(DEMO_RULESET), SCENARIO_SINGLE);
    expect(r.copay.state).toBe("excluded");
    expect(r.copay.value).toBe(0);
    expect(r.copay.trace).toBeNull();
  });

  it("is a range while unclassified items leave the admissible amount open", () => {
    const r = evaluate(confirmed(withCopay), SCENARIO_SINGLE);
    expect(r.copay.state).toBe("conditional");
    expect(r.copay.range).toEqual({ low: rupees(13_150), high: rupees(13_525), basis: expect.any(String) });
    expect(r.totals.calculatedDeductions).toBe(rupees(53_000));
    expect(r.totals.conditionalDeductions).toEqual({ low: rupees(13_150), high: rupees(13_525), basis: expect.any(String) });
  });

  it("is calculated once every item is classified, and joins the calculated deductions", () => {
    const r = evaluate(
      confirmed(withCopay, { confirmations: { hospitalFollowsDifferentialBilling: true, itemClassifications: { physio: "includedInDeduction", admin: "includedInDeduction" } } }),
      SCENARIO_SINGLE,
    );
    expect(r.copay.state).toBe("calculated");
    expect(r.copay.value).toBe(rupees(13_400));
    expect(r.copay.trace?.source.clauseId).toBe("C6");
    expect(r.copay.trace?.formula).toContain("5%");
    expect(r.totals.calculatedDeductions).toBe(rupees(53_000 + 2_500 + 13_400));
  });

  it("stays unknown when the limits cannot be determined", () => {
    const r = evaluate({ ...confirmed(withCopay), schedule: null }, SCENARIO_SINGLE);
    expect(r.copay.state).toBe("unknown");
    expect(r.copay.value).toBeNull();
  });
});

describe("policy caveats: the fixture can flag items the insurer must confirm", () => {
  const withCaveat: PolicyRuleset = {
    ...DEMO_RULESET,
    rules: {
      ...DEMO_RULESET.rules,
      itemClasses: { ...DEMO_RULESET.rules.itemClasses!, included: [...DEMO_RULESET.rules.itemClasses!.included, "implant"], excluded: ["pharmacyConsumables", "diagnostics", "icu"] },
    },
    caveats: [
      {
        code: "WORDING_PREDATES_2020_NORMS",
        text: "This wording reduces implants; IRDAI's 2020 norms bar that for later filings. Whether the insurer applies it today requires confirmation.",
        affectedCategories: ["implant"],
        resolvableBy: "insurer",
        whatWouldResolveIt: "Ask the insurer in writing.",
      },
    ],
  };

  it("turns the affected item's deduction into a range and emits the caveat with the amount at stake", () => {
    const r = evaluate(confirmed(withCaveat), SCENARIO_SINGLE);
    const implant = item(r, "implant");
    expect(implant.deduction.state).toBe("conditional");
    expect(implant.deduction.range).toEqual({ low: 0, high: rupees(40_000), basis: expect.stringContaining("insurer") });
    const u = r.uncertainties.find((x) => x.code === "WORDING_PREDATES_2020_NORMS");
    expect(u?.affectedItemIds).toEqual(["implant"]);
    expect(u?.amountAtStake).toEqual({ low: 0, high: rupees(40_000), basis: expect.any(String) });
    expect(r.totals.calculatedDeductions).toBe(rupees(53_000));
    expect(r.totals.conditionalDeductions?.high).toBe(rupees(40_000));
  });

  it("emits nothing when no affected item is on the estimate", () => {
    const inputs = confirmed(withCaveat, { estimate: { ...DEMO_ESTIMATE, items: DEMO_ESTIMATE.items.filter((i) => i.category !== "implant") } });
    const r = evaluate(inputs, SCENARIO_SINGLE);
    expect(r.uncertainties.some((x) => x.code === "WORDING_PREDATES_2020_NORMS")).toBe(false);
  });
});
