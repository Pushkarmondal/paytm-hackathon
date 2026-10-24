import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { evidencePackJson, evidencePackMarkdown } from "@/model/report";
import { arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { SCENARIO_SINGLE, SCENARIO_TWIN, demoInputs } from "@/fixtures/demo-policy";

describe("evidence pack: the whole result, with every trace, as a document", () => {
  const inputs = demoInputs();
  const result = evaluate(inputs, SCENARIO_SINGLE);
  const md = evidencePackMarkdown(result, inputs);

  it("names the policy, its synthetic status, the scenario and the headline", () => {
    expect(md).toContain("Claim Sach Demo Health Policy");
    expect(md).toMatch(/synthetic/i);
    expect(md).toContain("Single private room");
    expect(md).toContain("₹15,000 calculated, plus ₹0 to ₹38,000 conditional, plus ₹7,500 not classified");
  });

  it("lists every item with its state and quotes the clause and formula behind each trace", () => {
    for (const item of result.items) expect(md).toContain(item.label);
    expect(md).toContain("deduction = ₹60,000 × (1 − 5,000 ÷ 7,500)");
    expect(md).toContain("Clause C3, page 3");
    expect(md).toContain("If the Insured Person occupies a room whose rent exceeds the limit in Clause C1");
  });

  it("includes the uncertainties, the not-modelled list and the disclaimer", () => {
    expect(md).toContain("DIFFERENTIAL_BILLING_NOT_ESTABLISHED");
    expect(md).toContain("Co-payment clauses");
    expect(md).toMatch(/not a guarantee of coverage/i);
  });

  it("includes the verification record for a real wording", () => {
    const r = evaluate(arogyaInputs(), SCENARIO_TWIN);
    const text = evidencePackMarkdown(r, arogyaInputs());
    expect(text).toContain("NIAHLIP20165V011920");
    expect(text).toContain("4e261c78014a210c3ba30aa813c820bfeb7751d153afd7e52e64be4d8f542d44");
  });

  it("exports JSON that round-trips and carries the versions", () => {
    const parsed = JSON.parse(evidencePackJson(result, inputs));
    expect(parsed.engineVersion).toBe(result.engineVersion);
    expect(parsed.result.items).toHaveLength(result.items.length);
    expect(parsed.inputs.ruleset.metadata.policyId).toBe("demo-health-policy");
  });
});
