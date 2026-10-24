import { describe, expect, it } from "vitest";
import { compareScenarios } from "@/engine/compare";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import { SCENARIO_SINGLE, SCENARIO_TWIN, demoInputs } from "@/fixtures/demo-policy";

describe("compareScenarios: Change your room. See the difference.", () => {
  const a = evaluate(demoInputs(), SCENARIO_TWIN);
  const b = evaluate(demoInputs(), SCENARIO_SINGLE);
  const cmp = compareScenarios(a, b);

  it("reports the room rent and scenario total deltas", () => {
    expect(cmp.totals.roomRent).toEqual({ a: rupees(18_000), b: rupees(30_000), delta: rupees(12_000) });
    expect(cmp.totals.scenarioTotal.delta).toBe(rupees(12_000));
  });

  it("reports the calculated deductions delta and the conditional range delta separately", () => {
    expect(cmp.totals.calculatedDeductions).toEqual({ a: rupees(5_000), b: rupees(15_000), delta: rupees(10_000) });
    expect(cmp.totals.conditionalDeductions).toEqual({
      a: null,
      b: { low: 0, high: rupees(38_000), basis: expect.any(String) },
    });
  });

  it("marks exactly the rows that changed and names the rule behind each change", () => {
    const changed = cmp.rows.filter((r) => r.changed).map((r) => r.itemId);
    expect(changed.sort()).toEqual(["anaesthetist", "nursing", "ot", "surgeon"].sort());
    const surgeon = cmp.rows.find((r) => r.itemId === "surgeon");
    expect(surgeon?.causeRuleIds).toEqual(["C3.proportionateDeduction"]);
    expect(surgeon?.a.state).toBe("calculated");
    expect(surgeon?.b.state).toBe("conditional");
  });

  it("includes the room-rent row with the limit rule as its cause", () => {
    expect(cmp.roomExcess).toEqual({ a: 0, b: rupees(10_000), delta: rupees(10_000) });
    expect(cmp.changedRuleIds).toEqual(expect.arrayContaining(["C1.roomRentLimit", "C3.proportionateDeduction"]));
    expect(cmp.changedRuleIds).not.toContain("C2.icuLimit");
  });

  it("shows no change for excluded and unknown items", () => {
    for (const id of ["implant", "pharmacy", "diagnostics", "icu", "physio", "admin"]) {
      expect(cmp.rows.find((r) => r.itemId === id)?.changed).toBe(false);
    }
  });

  it("gives a plain money delta once both sides are calculated", () => {
    const confirmed = { ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } };
    const c = compareScenarios(evaluate(confirmed, SCENARIO_TWIN), evaluate(confirmed, SCENARIO_SINGLE));
    expect(c.totals.calculatedDeductions.delta).toBe(rupees(48_000));
    expect(c.rows.find((r) => r.itemId === "surgeon")?.delta).toBe(rupees(20_000));
  });
});
