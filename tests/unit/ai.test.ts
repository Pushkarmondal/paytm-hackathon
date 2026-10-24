import { describe, expect, it } from "vitest";
import { buildPrompt, buildRulesetFromProposals, parseProposalsResponse, verifyProposals } from "@/ai";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import { parseRulesetJson } from "@/ingestion";
import { NIA_CLAUSES, NIA_DEMO_SCHEDULE, NIA_RULESET } from "@/fixtures/arogya-sanjeevani-nia";
import { NIA_PROPOSALS } from "@/fixtures/arogya-sanjeevani-nia/llm-proposals";
import { DEMO_ESTIMATE, SCENARIO_TWIN } from "@/fixtures/demo-policy";

describe("verifyProposals: a proposal is usable only if its quote is verbatim in the clause it cites", () => {
  it("verifies every cached proposal against the extracted wording", () => {
    const verified = verifyProposals(NIA_PROPOSALS, NIA_CLAUSES);
    expect(verified).toHaveLength(NIA_PROPOSALS.length);
    for (const v of verified) {
      expect(v.verification.quoteFound, v.proposal.id).toBe(true);
      expect(v.verification.clauseExists).toBe(true);
      expect(v.verification.problems).toEqual([]);
    }
  });

  it("flags a quote that is not in the clause, and a clause that does not exist", () => {
    const tampered = { ...NIA_PROPOSALS[0], quotedText: "up to 3% of the sum insured" };
    const ghost = { ...NIA_PROPOSALS[1], clauseId: "99.9" };
    const [t, g] = verifyProposals([tampered, ghost], NIA_CLAUSES);
    expect(t.verification.quoteFound).toBe(false);
    expect(t.verification.problems.join(" ")).toMatch(/4\.1\(a\)/);
    expect(g.verification.clauseExists).toBe(false);
  });
});

describe("buildRulesetFromProposals: confirmed proposals become rules with full-clause evidence", () => {
  const verified = verifyProposals(NIA_PROPOSALS, NIA_CLAUSES);
  const ruleset = buildRulesetFromProposals({ metadata: NIA_RULESET.metadata, clauses: NIA_CLAUSES, fixtureVersion: "builder-test" }, verified.map((v) => v.proposal));

  it("assembles every rule kind with the cited clause quoted in full", () => {
    expect(ruleset.rules.roomLimit?.basis).toEqual({ kind: "percentOfSumInsuredPerDay", percent: 2, capPerDay: rupees(5_000) });
    expect(ruleset.rules.roomLimit?.source.quotedText).toBe(NIA_CLAUSES.find((c) => c.id === "4.1(a)")!.text);
    expect(ruleset.rules.icuLimit?.basis).toEqual({ kind: "percentOfSumInsuredPerDay", percent: 5, capPerDay: rupees(10_000) });
    expect(ruleset.rules.proportionateDeduction?.triggers).toEqual(["room", "icu"]);
    expect(ruleset.rules.copay?.percent).toBe(5);
    expect(ruleset.rules.sumInsuredCap?.source.clauseId).toBe("2");
    expect(ruleset.rules.itemClasses?.excluded).toEqual(["pharmacyConsumables"]);
  });

  it("passes the ingestion evidence check and runs through the engine", () => {
    expect(parseRulesetJson(JSON.stringify(ruleset)).ok).toBe(true);
    const r = evaluate({ ruleset, schedule: NIA_DEMO_SCHEDULE, estimate: DEMO_ESTIMATE, confirmations: {} }, SCENARIO_TWIN);
    expect(r.roomLimit.eligiblePerDay).toBe(rupees(5_000));
    expect(r.deductionRule.trigger).toBe("icu");
    expect(r.items.find((i) => i.itemId === "surgeon")?.deduction.value).toBe(rupees(20_000));
  });

  it("leaves out rules whose proposals were not confirmed", () => {
    const partial = buildRulesetFromProposals({ metadata: NIA_RULESET.metadata, clauses: NIA_CLAUSES, fixtureVersion: "x" }, [NIA_PROPOSALS[0]]);
    expect(partial.rules.roomLimit).toBeDefined();
    expect(partial.rules.proportionateDeduction).toBeUndefined();
    expect(partial.rules.copay).toBeUndefined();
  });

  it("refuses an unverified proposal", () => {
    const tampered = { ...NIA_PROPOSALS[0], quotedText: "words not in the clause" };
    expect(() => buildRulesetFromProposals({ metadata: NIA_RULESET.metadata, clauses: NIA_CLAUSES, fixtureVersion: "x" }, [tampered])).toThrow(/verbatim/);
  });
});

describe("the live adapter's pure parts: prompt and parser", () => {
  it("builds a prompt that carries every clause verbatim and demands verbatim quotes", () => {
    const prompt = buildPrompt(NIA_CLAUSES);
    for (const c of NIA_CLAUSES) {
      expect(prompt).toContain(c.id);
      expect(prompt).toContain(c.text);
    }
    expect(prompt).toMatch(/verbatim/i);
    expect(prompt).toMatch(/PUBLIC wording/);
    expect(prompt).not.toMatch(/ANTHROPIC_API_KEY|Demo Insured|Demo Hospital/);
  });

  it("parses a JSON array, with or without a code fence, and validates each proposal", () => {
    const body = JSON.stringify([{ id: "x", kind: "copay", clauseId: "9.5", quotedText: "Co-Payment of 5%", rationale: "r", proposed: { percent: 5 } }]);
    expect(parseProposalsResponse(body).ok).toBe(true);
    expect(parseProposalsResponse("```json\n" + body + "\n```").ok).toBe(true);
    expect(parseProposalsResponse("not json").ok).toBe(false);
    expect(parseProposalsResponse(JSON.stringify([{ kind: "nonsense" }])).ok).toBe(false);
  });
});
