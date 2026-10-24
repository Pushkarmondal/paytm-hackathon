import { describe, expect, it } from "vitest";
import { computeExcess, resolveLimit } from "@/engine/limits";
import { rupees } from "@/engine/money";
import {
  DEMO_RULESET,
  DEMO_SCHEDULE,
  DEMO_SCHEDULE_CONTRADICTORY,
} from "@/fixtures/demo-policy";

describe("resolveLimit: policy-specific room and ICU limits", () => {
  it("derives the room limit from 1% of the sum insured and cites C1", () => {
    const limit = resolveLimit("room", DEMO_RULESET, DEMO_SCHEDULE);
    expect(limit.state).toBe("calculated");
    expect(limit.eligiblePerDay).toBe(rupees(5_000));
    expect(limit.trace?.source.clauseId).toBe("C1");
    expect(limit.trace?.operation).toBe("limit.percentOfSumInsuredPerDay");
    expect(limit.uncertainty).toBeNull();
  });

  it("derives the ICU limit from 2% of the sum insured and cites C2", () => {
    const limit = resolveLimit("icu", DEMO_RULESET, DEMO_SCHEDULE);
    expect(limit.state).toBe("calculated");
    expect(limit.eligiblePerDay).toBe(rupees(10_000));
    expect(limit.trace?.source.clauseId).toBe("C2");
  });

  it("cannot determine a limit without the policy schedule (no silent zero)", () => {
    const limit = resolveLimit("room", DEMO_RULESET, null);
    expect(limit.state).toBe("unknown");
    expect(limit.eligiblePerDay).toBeNull();
    expect(limit.uncertainty?.code).toBe("SCHEDULE_MISSING");
    expect(limit.uncertainty?.resolvableBy).toBe("user");
  });

  it("returns review-required when the schedule contradicts the wording", () => {
    const limit = resolveLimit("room", DEMO_RULESET, DEMO_SCHEDULE_CONTRADICTORY);
    expect(limit.state).toBe("reviewRequired");
    expect(limit.eligiblePerDay).toBeNull();
    expect(limit.uncertainty?.code).toBe("SCHEDULE_CONTRADICTS_WORDING");
    expect(limit.uncertainty?.text).toContain("6,000");
    expect(limit.uncertainty?.text).toContain("5,000");
  });

  it("cannot determine a limit the wording does not define", () => {
    const ruleset = { ...DEMO_RULESET, rules: { ...DEMO_RULESET.rules, icuLimit: undefined } };
    const limit = resolveLimit("icu", ruleset, DEMO_SCHEDULE);
    expect(limit.state).toBe("unknown");
    expect(limit.uncertainty?.code).toBe("LIMIT_RULE_ABSENT");
  });
});

describe("computeExcess: the amount above the limit", () => {
  const roomLimit = resolveLimit("room", DEMO_RULESET, DEMO_SCHEDULE);

  it("is zero, and calculated, when the selected room is within the entitlement", () => {
    const excess = computeExcess(roomLimit, rupees(4_500), 4, "fixture");
    expect(excess.state).toBe("calculated");
    expect(excess.value).toBe(0);
    expect(excess.trace?.source.clauseId).toBe("C1");
  });

  it("is (rate − eligible) × days when the room exceeds the entitlement", () => {
    const excess = computeExcess(roomLimit, rupees(7_500), 4, "fixture");
    expect(excess.state).toBe("calculated");
    expect(excess.value).toBe(rupees(10_000));
    expect(excess.trace?.formula).toContain("7,500");
    expect(excess.trace?.formula).toContain("5,000");
    expect(excess.trace?.inputs.map((i) => i.name)).toEqual(
      expect.arrayContaining(["ratePerDay", "eligiblePerDay", "days"]),
    );
  });

  it("is unknown when the limit is unknown, never zero", () => {
    const unknownLimit = resolveLimit("room", DEMO_RULESET, null);
    const excess = computeExcess(unknownLimit, rupees(7_500), 4, "fixture");
    expect(excess.state).toBe("unknown");
    expect(excess.value).toBeNull();
    expect(excess.trace).toBeNull();
  });
});
