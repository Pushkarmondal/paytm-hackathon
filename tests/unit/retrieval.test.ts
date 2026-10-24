import { describe, expect, it } from "vitest";
import { retrieveClauses, tokenize } from "@/retrieval";
import { DEMO_CLAUSES } from "@/fixtures/demo-policy";

describe("tokenize", () => {
  it("lowercases, drops stopwords and punctuation, and folds simple plurals", () => {
    expect(tokenize("The Hospital's ICU charges, per day.")).toEqual(["hospital", "icu", "charge", "per", "day"]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("retrieveClauses: deterministic keyword retrieval over the wording", () => {
  it("returns the room rent clause for a room rent question", () => {
    const hits = retrieveClauses("Which clause sets the room rent limit?", DEMO_CLAUSES);
    expect(hits[0]?.clauseId).toBe("C1");
  });

  it("returns ranked hits with scores, best first, at most the limit", () => {
    const hits = retrieveClauses("associated medical expenses definition", DEMO_CLAUSES, 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
    expect(hits[0].clauseId).toBe("C4");
  });

  it("returns nothing for a query with no overlap, instead of guessing", () => {
    expect(retrieveClauses("zebra quantum", DEMO_CLAUSES)).toEqual([]);
  });

  it("is deterministic", () => {
    const q = "when does the proportionate deduction apply";
    expect(retrieveClauses(q, DEMO_CLAUSES)).toEqual(retrieveClauses(q, DEMO_CLAUSES));
  });
});
