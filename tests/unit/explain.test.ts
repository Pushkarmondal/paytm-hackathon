import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { explainTrace, explainWith, nullAdapter } from "@/explain";
import { DEMO_RULESET_WITHOUT_DEDUCTION, SCENARIO_SINGLE, SCENARIO_TWIN, demoInputs } from "@/fixtures/demo-policy";

const single = evaluate(demoInputs(), SCENARIO_SINGLE);
const confirmed = evaluate({ ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } }, SCENARIO_SINGLE);
const twin = evaluate(demoInputs(), SCENARIO_TWIN);
const item = (r: typeof single, id: string) => r.items.find((i) => i.itemId === id)!;

describe("explainTrace: plain words generated from the trace, never from a model", () => {
  it("explains a percent-of-sum-insured limit", () => {
    const text = explainTrace(single.roomLimit.trace!);
    expect(text).toContain("1%");
    expect(text).toContain("₹5,000 per day");
    expect(text).toContain("clause C1");
  });

  it("explains an amount above the limit", () => {
    const text = explainTrace(single.roomExcess.trace!);
    expect(text).toContain("₹7,500");
    expect(text).toContain("₹5,000");
    expect(text).toContain("4 days");
    expect(text).toContain("₹10,000");
  });

  it("explains a conditional deduction as a range with its condition", () => {
    const text = explainTrace(item(single, "surgeon").trace!);
    expect(text).toMatch(/differential billing/i);
    expect(text).toContain("₹0 and ₹20,000");
  });

  it("explains an established deduction with its proportion", () => {
    const text = explainTrace(item(confirmed, "surgeon").trace!);
    expect(text).toContain("5,000 ÷ 7,500");
    expect(text).toContain("₹20,000");
    expect(text).not.toMatch(/between/);
  });

  it("explains a room within the entitlement", () => {
    expect(explainTrace(item(twin, "surgeon").trace!)).toMatch(/within the eligible/);
  });

  it("explains an excluded item by its clause", () => {
    expect(explainTrace(item(single, "implant").trace!)).toMatch(/clause C4/);
  });

  it("explains an absent rule without inventing one", () => {
    const r = evaluate({ ...demoInputs(), ruleset: DEMO_RULESET_WITHOUT_DEDUCTION }, SCENARIO_SINGLE);
    expect(explainTrace(item(r, "surgeon").trace!)).toMatch(/no proportionate deduction clause/i);
  });
});

describe("explainWith: the optional adapter never replaces the deterministic text and is off by default", () => {
  it("falls back to the deterministic explanation when the adapter is unavailable", async () => {
    expect(nullAdapter.available).toBe(false);
    const out = await explainWith(nullAdapter, single.roomLimit.trace!);
    expect(out.text).toBe(explainTrace(single.roomLimit.trace!));
    expect(out.source).toBe("deterministic");
  });

  it("labels adapter prose as an explanation and keeps the deterministic text alongside", async () => {
    const adapter = { name: "fake", available: true, explain: async () => "Some prose." };
    const out = await explainWith(adapter, single.roomLimit.trace!);
    expect(out.source).toBe("adapter");
    expect(out.text).toBe("Some prose.");
    expect(out.deterministic).toBe(explainTrace(single.roomLimit.trace!));
  });

  it("falls back when the adapter fails or returns nothing", async () => {
    const failing = { name: "fake", available: true, explain: async () => { throw new Error("down"); } };
    expect((await explainWith(failing, single.roomLimit.trace!)).source).toBe("deterministic");
    const empty = { name: "fake", available: true, explain: async () => null };
    expect((await explainWith(empty, single.roomLimit.trace!)).source).toBe("deterministic");
  });
});
