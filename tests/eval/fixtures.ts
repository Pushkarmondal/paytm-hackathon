/**
 * Human-reviewable evaluation fixtures. Expected values were written by hand
 * before the measures were run; they are not copied from engine output.
 *
 * Authored: 24 October 2026, by the build session (Claude) from docs/PRD.md
 * Appendix A. Human review by Pushkar Mondal: pending.
 */

import type { ExtractedRules } from "@/extraction";
import { rupees, type Money } from "@/engine/money";
import type { CaseInputs, OverallState, Scenario, SimulationResult, UncertaintyCode } from "@/engine/types";
import {
  DEMO_ESTIMATE,
  DEMO_RULESET,
  DEMO_RULESET_WITHOUT_DEDUCTION,
  DEMO_SCHEDULE_CONTRADICTORY,
  SCENARIO_DELUXE,
  SCENARIO_SINGLE,
  SCENARIO_TWIN,
  demoInputs,
} from "@/fixtures/demo-policy";

export const FIXTURE_REVIEW = {
  authoredOn: "2026-10-24",
  authoredBy: "the build session (Claude), from docs/PRD.md Appendix A",
  humanReview: "pending (Pushkar Mondal)",
};

/** Clause retrieval: question → the clause a careful reader would point to. */
export const RETRIEVAL_CASES: { question: string; expected: string }[] = [
  { question: "Which clause sets the room rent limit?", expected: "C1" },
  { question: "How much of the ICU charge is payable per day?", expected: "C2" },
  { question: "When does the proportionate deduction apply?", expected: "C3" },
  { question: "What counts as Associated Medical Expenses?", expected: "C4" },
  { question: "Are implants part of Associated Medical Expenses?", expected: "C4" },
  { question: "Does the deduction apply if the hospital does not follow differential billing?", expected: "C3" },
  { question: "What is the most the company pays in a policy year?", expected: "C5" },
  { question: "Does the proportionate deduction apply to ICU charges?", expected: "C2" },
  { question: "Is pharmacy subject to the proportionate deduction?", expected: "C4" },
  { question: "What percentage of the sum insured is the room rent limit?", expected: "C1" },
  { question: "Is boarding included in the room rent limit?", expected: "C1" },
  { question: "Which room rate am I entitled to?", expected: "C1" },
];

/** Rule extraction: field by field against the human-reviewed ruleset. */
export const EXTRACTION_FIELDS: { field: string; expected: unknown; actual: (e: ExtractedRules) => unknown }[] = [
  { field: "roomLimit.clauseId", expected: DEMO_RULESET.rules.roomLimit!.source.clauseId, actual: (e) => e.roomLimit?.clauseId },
  { field: "roomLimit.basis", expected: DEMO_RULESET.rules.roomLimit!.basis, actual: (e) => e.roomLimit?.basis },
  { field: "icuLimit.clauseId", expected: DEMO_RULESET.rules.icuLimit!.source.clauseId, actual: (e) => e.icuLimit?.clauseId },
  { field: "icuLimit.basis", expected: DEMO_RULESET.rules.icuLimit!.basis, actual: (e) => e.icuLimit?.basis },
  { field: "proportionateDeduction.clauseId", expected: DEMO_RULESET.rules.proportionateDeduction!.source.clauseId, actual: (e) => e.proportionateDeduction?.clauseId },
  { field: "proportionateDeduction.conditions", expected: DEMO_RULESET.rules.proportionateDeduction!.conditions.map((c) => c.conditionId), actual: (e) => e.proportionateDeduction?.conditions },
  { field: "itemClasses.clauseId", expected: DEMO_RULESET.rules.itemClasses!.source.clauseId, actual: (e) => e.itemClasses?.clauseId },
  { field: "itemClasses.included", expected: [...DEMO_RULESET.rules.itemClasses!.included].sort(), actual: (e) => (e.itemClasses ? [...e.itemClasses.included].sort() : undefined) },
  { field: "itemClasses.excluded", expected: [...DEMO_RULESET.rules.itemClasses!.excluded].sort(), actual: (e) => (e.itemClasses ? [...e.itemClasses.excluded].sort() : undefined) },
  { field: "sumInsuredCap.clauseId", expected: DEMO_RULESET.rules.sumInsuredCap!.source.clauseId, actual: (e) => e.sumInsuredCap?.clauseId },
];

export interface CalculationCase {
  name: string;
  inputs: CaseInputs;
  scenario: Scenario;
  /** Field name → expected value, read from the result by `read`. */
  expect: { field: string; expected: Money | number | null; read: (r: SimulationResult) => Money | number | null | undefined }[];
}

const confirmed = (): CaseInputs => ({ ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } });
const item = (r: SimulationResult, id: string) => r.items.find((i) => i.itemId === id)?.deduction.value;
const itemHigh = (r: SimulationResult, id: string) => r.items.find((i) => i.itemId === id)?.deduction.range?.high;

export const CALCULATION_CASES: CalculationCase[] = [
  {
    name: "A: twin-sharing within the limit",
    inputs: demoInputs(),
    scenario: SCENARIO_TWIN,
    expect: [
      { field: "roomRent", expected: rupees(18_000), read: (r) => r.totals.roomRent },
      { field: "scenarioTotal", expected: rupees(311_500), read: (r) => r.totals.scenarioTotal },
      { field: "roomExcess", expected: 0, read: (r) => r.roomExcess.value },
      { field: "icuExcess", expected: rupees(5_000), read: (r) => r.icuExcess.value },
      { field: "calculatedDeductions", expected: rupees(5_000), read: (r) => r.totals.calculatedDeductions },
      { field: "surgeon", expected: 0, read: (r) => item(r, "surgeon") },
      { field: "unclassified", expected: rupees(7_500), read: (r) => r.totals.unclassifiedAmount },
    ],
  },
  {
    name: "B: single private, differential billing not stated (conditional)",
    inputs: demoInputs(),
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "roomRent", expected: rupees(30_000), read: (r) => r.totals.roomRent },
      { field: "scenarioTotal", expected: rupees(323_500), read: (r) => r.totals.scenarioTotal },
      { field: "roomExcess", expected: rupees(10_000), read: (r) => r.roomExcess.value },
      { field: "calculatedDeductions", expected: rupees(15_000), read: (r) => r.totals.calculatedDeductions },
      { field: "conditionalHigh", expected: rupees(38_000), read: (r) => r.totals.conditionalDeductions?.high },
      { field: "conditionalLow", expected: 0, read: (r) => r.totals.conditionalDeductions?.low },
      { field: "surgeonHigh", expected: rupees(20_000), read: (r) => itemHigh(r, "surgeon") },
      { field: "nursingHigh", expected: 133_333, read: (r) => itemHigh(r, "nursing") },
    ],
  },
  {
    name: "B: single private, differential billing confirmed",
    inputs: confirmed(),
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "calculatedDeductions", expected: rupees(53_000), read: (r) => r.totals.calculatedDeductions },
      { field: "nursing", expected: 133_333, read: (r) => item(r, "nursing") },
      { field: "surgeon", expected: rupees(20_000), read: (r) => item(r, "surgeon") },
      { field: "anaesthetist", expected: rupees(5_000), read: (r) => item(r, "anaesthetist") },
      { field: "ot", expected: 1_166_667, read: (r) => item(r, "ot") },
      { field: "implant", expected: 0, read: (r) => item(r, "implant") },
      { field: "conditional", expected: null, read: (r) => r.totals.conditionalDeductions?.high ?? null },
    ],
  },
  {
    name: "B': deluxe, confirmed (ratio 5/12)",
    inputs: confirmed(),
    scenario: SCENARIO_DELUXE,
    expect: [
      { field: "roomRent", expected: rupees(48_000), read: (r) => r.totals.roomRent },
      { field: "scenarioTotal", expected: rupees(341_500), read: (r) => r.totals.scenarioTotal },
      { field: "roomExcess", expected: rupees(28_000), read: (r) => r.roomExcess.value },
      { field: "nursing", expected: 233_333, read: (r) => item(r, "nursing") },
      { field: "surgeon", expected: rupees(35_000), read: (r) => item(r, "surgeon") },
      { field: "anaesthetist", expected: rupees(8_750), read: (r) => item(r, "anaesthetist") },
      { field: "ot", expected: 2_041_667, read: (r) => item(r, "ot") },
      { field: "calculatedDeductions", expected: rupees(99_500), read: (r) => r.totals.calculatedDeductions },
    ],
  },
  {
    name: "B at an edited rate of ₹10,000 per day, confirmed (ratio 1/2)",
    inputs: confirmed(),
    scenario: { ...SCENARIO_SINGLE, roomRatePerDay: rupees(10_000) },
    expect: [
      { field: "roomRent", expected: rupees(40_000), read: (r) => r.totals.roomRent },
      { field: "roomExcess", expected: rupees(20_000), read: (r) => r.roomExcess.value },
      { field: "surgeon", expected: rupees(30_000), read: (r) => item(r, "surgeon") },
      { field: "calculatedDeductions", expected: rupees(82_000), read: (r) => r.totals.calculatedDeductions },
    ],
  },
  {
    name: "B when the estimate states no differential billing",
    inputs: { ...demoInputs(), estimate: { ...DEMO_ESTIMATE, differentialBilling: "no" } },
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "calculatedDeductions", expected: rupees(15_000), read: (r) => r.totals.calculatedDeductions },
      { field: "surgeon", expected: 0, read: (r) => item(r, "surgeon") },
      { field: "conditional", expected: null, read: (r) => r.totals.conditionalDeductions?.high ?? null },
    ],
  },
  {
    name: "B under the wording without a deduction clause, confirmed",
    inputs: { ...confirmed(), ruleset: DEMO_RULESET_WITHOUT_DEDUCTION },
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "roomExcess", expected: rupees(10_000), read: (r) => r.roomExcess.value },
      { field: "surgeon", expected: 0, read: (r) => item(r, "surgeon") },
      { field: "calculatedDeductions", expected: rupees(15_000), read: (r) => r.totals.calculatedDeductions },
    ],
  },
  {
    name: "B over 5 room days, confirmed",
    inputs: { ...confirmed(), estimate: { ...DEMO_ESTIMATE, roomDays: 5 } },
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "roomRent", expected: rupees(37_500), read: (r) => r.totals.roomRent },
      { field: "roomExcess", expected: rupees(12_500), read: (r) => r.roomExcess.value },
      { field: "calculatedDeductions", expected: rupees(55_500), read: (r) => r.totals.calculatedDeductions },
    ],
  },
  {
    name: "B with physiotherapy classified by the user as associated, confirmed",
    inputs: { ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true, itemClassifications: { physio: "includedInDeduction" } } },
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "physio", expected: rupees(2_000), read: (r) => item(r, "physio") },
      { field: "calculatedDeductions", expected: rupees(55_000), read: (r) => r.totals.calculatedDeductions },
      { field: "unclassified", expected: rupees(1_500), read: (r) => r.totals.unclassifiedAmount },
    ],
  },
];

export interface RefusalCase {
  name: string;
  inputs: CaseInputs;
  scenario: Scenario;
  expectedOverall: OverallState;
  /** Values that must be null (no fabricated number). */
  mustBeNull: { field: string; read: (r: SimulationResult) => unknown }[];
  expectedCodes: UncertaintyCode[];
}

export const REFUSAL_CASES: RefusalCase[] = [
  {
    name: "Policy schedule missing",
    inputs: { ...demoInputs(), schedule: null },
    scenario: SCENARIO_SINGLE,
    expectedOverall: "cannotDetermine",
    mustBeNull: [
      { field: "roomLimit.eligiblePerDay", read: (r) => r.roomLimit.eligiblePerDay },
      { field: "roomExcess.value", read: (r) => r.roomExcess.value },
      { field: "icuExcess.value", read: (r) => r.icuExcess.value },
      { field: "surgeon.deduction.value", read: (r) => item(r, "surgeon") },
      { field: "totals.conditionalDeductions", read: (r) => r.totals.conditionalDeductions },
    ],
    expectedCodes: ["SCHEDULE_MISSING"],
  },
  {
    name: "Schedule contradicts the wording",
    inputs: { ...demoInputs(), schedule: DEMO_SCHEDULE_CONTRADICTORY },
    scenario: SCENARIO_SINGLE,
    expectedOverall: "reviewRequired",
    mustBeNull: [
      { field: "roomLimit.eligiblePerDay", read: (r) => r.roomLimit.eligiblePerDay },
      { field: "roomExcess.value", read: (r) => r.roomExcess.value },
      { field: "surgeon.deduction.value", read: (r) => item(r, "surgeon") },
    ],
    expectedCodes: ["SCHEDULE_CONTRADICTS_WORDING"],
  },
  {
    name: "Differential billing not established",
    inputs: demoInputs(),
    scenario: SCENARIO_SINGLE,
    expectedOverall: "conditional",
    mustBeNull: [{ field: "surgeon.deduction.value", read: (r) => item(r, "surgeon") }],
    expectedCodes: ["DIFFERENTIAL_BILLING_NOT_ESTABLISHED", "WORDING_SILENT_ON_ROOM_UNAVAILABILITY", "ITEM_NOT_CLASSIFIED"],
  },
  {
    name: "Items the wording does not classify",
    inputs: confirmed(),
    scenario: SCENARIO_TWIN,
    expectedOverall: "calculated",
    mustBeNull: [
      { field: "physio.deduction.value", read: (r) => item(r, "physio") },
      { field: "admin.deduction.value", read: (r) => item(r, "admin") },
    ],
    expectedCodes: ["ITEM_NOT_CLASSIFIED"],
  },
  {
    name: "Wording without a deduction clause",
    inputs: { ...confirmed(), ruleset: DEMO_RULESET_WITHOUT_DEDUCTION },
    scenario: SCENARIO_SINGLE,
    expectedOverall: "calculated",
    mustBeNull: [],
    expectedCodes: ["RULE_ABSENT"],
  },
  {
    name: "ICU line without a per-day rate",
    inputs: { ...confirmed(), estimate: { ...DEMO_ESTIMATE, items: DEMO_ESTIMATE.items.map((i) => (i.itemId === "icu" ? { ...i, perDay: undefined } : i)) } },
    scenario: SCENARIO_TWIN,
    expectedOverall: "calculated",
    mustBeNull: [{ field: "icuExcess.value", read: (r) => r.icuExcess.value }],
    expectedCodes: ["ICU_RATE_NOT_STATED"],
  },
];
