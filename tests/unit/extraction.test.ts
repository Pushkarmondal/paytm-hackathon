import { describe, expect, it } from "vitest";
import { extractRules } from "@/extraction";
import { rupees } from "@/engine/money";
import type { Clause } from "@/engine/types";
import { DEMO_CLAUSES } from "@/fixtures/demo-policy";

describe("extractRules: deterministic candidates from clause text, for human review", () => {
  const extracted = extractRules(DEMO_CLAUSES);

  it("finds a percent-of-sum-insured room limit and cites its clause", () => {
    expect(extracted.roomLimit).toEqual({ clauseId: "C1", basis: { kind: "percentOfSumInsuredPerDay", percent: 1 } });
  });

  it("finds the ICU limit", () => {
    expect(extracted.icuLimit).toEqual({ clauseId: "C2", basis: { kind: "percentOfSumInsuredPerDay", percent: 2 } });
  });

  it("finds the proportionate deduction with its differential-billing condition", () => {
    expect(extracted.proportionateDeduction).toEqual({ clauseId: "C3", conditions: ["hospitalFollowsDifferentialBilling"] });
  });

  it("reads the included and excluded categories from the definition clause", () => {
    expect(extracted.itemClasses?.clauseId).toBe("C4");
    expect([...(extracted.itemClasses?.included ?? [])].sort()).toEqual(["anaesthetistFees", "consultantFees", "nursing", "operationTheatre", "surgeonFees"].sort());
    expect([...(extracted.itemClasses?.excluded ?? [])].sort()).toEqual(["diagnostics", "icu", "implant", "pharmacyConsumables"].sort());
  });

  it("finds the sum insured cap", () => {
    expect(extracted.sumInsuredCap).toEqual({ clauseId: "C5" });
  });

  it("reads a fixed per-day limit written in rupees", () => {
    const clauses: Clause[] = [{ id: "R1", title: "Room", page: 1, text: "Room rent is payable up to Rs. 4,000 per day." }];
    expect(extractRules(clauses).roomLimit).toEqual({ clauseId: "R1", basis: { kind: "fixedPerDay", amount: rupees(4_000) } });
  });

  it("extracts nothing from text that states no rule, rather than inventing one", () => {
    const clauses: Clause[] = [{ id: "X", title: "Preamble", page: 1, text: "This policy is a contract between the Company and the Policyholder." }];
    expect(extractRules(clauses)).toEqual({});
  });

  it("detects a proportionate deduction without the differential-billing condition", () => {
    const clauses: Clause[] = [{ id: "P", title: "Deduction", page: 2, text: "If a higher room category is occupied, Associated Medical Expenses are payable in the same proportion as the eligible room rent bears to the actual room rent." }];
    expect(extractRules(clauses).proportionateDeduction).toEqual({ clauseId: "P", conditions: [] });
  });
});
