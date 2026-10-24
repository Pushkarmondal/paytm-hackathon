import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import { collectTraces, validateTrace } from "@/engine/trace";
import { parseRulesetJson } from "@/ingestion";
import { NIA_CLAUSES, NIA_DEMO_SCHEDULE, NIA_RULESET, arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { SCENARIO_DELUXE, SCENARIO_SINGLE, SCENARIO_TWIN } from "@/fixtures/demo-policy";

const item = (r: ReturnType<typeof evaluate>, id: string) => r.items.find((i) => i.itemId === id)!;

describe("Arogya Sanjeevani (New India, IRDAI-hosted): a real wording through the same engine", () => {
  const twin = evaluate(arogyaInputs(), SCENARIO_TWIN);
  const single = evaluate(arogyaInputs(), SCENARIO_SINGLE);
  const deluxe = evaluate(arogyaInputs(), SCENARIO_DELUXE);

  it("is labelled insurer-issued with its UIN and verification record, and passes the ingestion evidence check", () => {
    expect(twin.policy.issuer.kind).toBe("insurer");
    if (twin.policy.issuer.kind === "insurer") expect(twin.policy.issuer.uin).toBe("NIAHLIP20165V011920");
    expect(NIA_RULESET.metadata.verification?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(NIA_RULESET.metadata.verification?.encodedClauses.length).toBeGreaterThan(5);
    const parsed = parseRulesetJson(JSON.stringify(NIA_RULESET));
    expect(parsed.ok).toBe(true);
  });

  it("applies the capped limits: ₹5,000 room and ₹10,000 ICU on a ₹5,00,000 sum insured", () => {
    expect(twin.roomLimit.eligiblePerDay).toBe(rupees(5_000));
    expect(twin.icuLimit.eligiblePerDay).toBe(rupees(10_000));
    expect(twin.roomLimit.trace?.operation).toBe("limit.percentOfSumInsuredPerDayCapped");
  });

  it("twin-sharing: the ₹15,000 ICU day alone triggers the proportion under 4.1.1 Note (b)", () => {
    expect(twin.roomExcess.value).toBe(0);
    expect(twin.icuExcess.value).toBe(rupees(5_000));
    expect(twin.deductionRule.trigger).toBe("icu");
    expect(twin.deductionRule.applicability).toBe("applies");
    expect(twin.deductionRule.ratio).toEqual({ num: 2, den: 3 });
    expect(item(twin, "surgeon").deduction.value).toBe(rupees(20_000));
    expect(item(twin, "physio").deduction.value).toBe(rupees(2_000));
  });

  it("twin-sharing: implants and diagnostics become ranges because the wording predates the 2020 norms", () => {
    expect(item(twin, "implant").deduction.state).toBe("conditional");
    expect(item(twin, "implant").deduction.range?.high).toBe(rupees(40_000));
    expect(item(twin, "diagnostics").deduction.range?.high).toBe(rupees(4_000));
    const u = twin.uncertainties.find((x) => x.code === "WORDING_PREDATES_2020_NORMS");
    expect(u?.affectedItemIds.sort()).toEqual(["diagnostics", "implant"]);
    expect(u?.amountAtStake).toEqual({ low: 0, high: rupees(44_000), basis: expect.any(String) });
    expect(u?.resolvableBy).toBe("insurer");
  });

  it("twin-sharing: pharmacy stays unclassified with the wording's own reason, and the nursing notice is raised", () => {
    expect(item(twin, "pharmacy").deduction.state).toBe("unknown");
    const unc = twin.uncertainties.find((x) => x.code === "ITEM_NOT_CLASSIFIED");
    expect(unc?.text).toMatch(/medicines/);
    expect(twin.totals.unclassifiedAmount).toBe(rupees(26_500));
    expect(twin.uncertainties.some((x) => x.code === "POLICY_CAVEAT" && x.affectedItemIds.includes("nursing"))).toBe(true);
    expect(twin.uncertainties.some((x) => x.code === "WORDING_SILENT_ON_ROOM_UNAVAILABILITY")).toBe(false);
  });

  it("twin-sharing: co-payment is a range and the totals keep calculated and conditional apart", () => {
    expect(twin.totals.calculatedDeductions).toBe(rupees(45_000));
    expect(twin.copay.state).toBe("conditional");
    expect(twin.copay.range).toEqual({ low: rupees(9_800), high: rupees(13_325), basis: expect.any(String) });
    expect(twin.totals.conditionalDeductions).toEqual({ low: rupees(9_800), high: rupees(57_325), basis: expect.any(String) });
    expect(twin.overallState).toBe("conditional");
  });

  it("single private: room and ICU exceed in the same proportion, so one ratio applies", () => {
    expect(single.deductionRule.trigger).toBe("both");
    expect(single.deductionRule.applicability).toBe("applies");
    expect(single.deductionRule.ratio).toEqual({ num: 2, den: 3 });
    expect(single.roomExcess.value).toBe(rupees(10_000));
    expect(single.totals.calculatedDeductions).toBe(rupees(55_000));
    expect(single.copay.range).toEqual({ low: rupees(9_900), high: rupees(13_425), basis: expect.any(String) });
    expect(single.uncertainties.some((x) => x.code === "WORDING_SILENT_ON_ROOM_UNAVAILABILITY")).toBe(true);
  });

  it("deluxe: room and ICU exceed in different proportions, so the engine refuses to pick one", () => {
    expect(deluxe.deductionRule.trigger).toBe("both");
    expect(deluxe.deductionRule.applicability).toBe("conditional");
    expect(deluxe.deductionRule.ratio).toBeNull();
    expect(item(deluxe, "surgeon").deduction.range).toEqual({ low: rupees(20_000), high: rupees(35_000), basis: expect.stringContaining("ICU") });
    const u = deluxe.uncertainties.find((x) => x.code === "RATIO_AMBIGUOUS_ROOM_AND_ICU");
    expect(u?.amountAtStake).toEqual({ low: rupees(84_000), high: rupees(147_000), basis: expect.any(String) });
  });

  it("every trace quotes the real wording verbatim, page-cited", () => {
    for (const r of [twin, single, deluxe]) {
      for (const trace of collectTraces(r)) {
        expect(validateTrace(trace, NIA_CLAUSES, [NIA_DEMO_SCHEDULE]), `${r.scenario.scenarioId}/${trace.ruleId}`).toEqual([]);
      }
    }
  });
});
