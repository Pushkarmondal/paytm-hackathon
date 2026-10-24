/**
 * Evaluation fixtures for the REAL wording: Arogya Sanjeevani, The New India
 * Assurance Co. Ltd. (UIN NIAHLIP20165V011920), IRDAI-hosted.
 *
 * Expected values were computed by hand before running the measures.
 * Authored: 24 October 2026, by the build session (Claude).
 * Human review by Pushkar Mondal: pending.
 */

import type { ExtractedRules } from "@/extraction";
import { rupees } from "@/engine/money";
import type { SimulationResult } from "@/engine/types";
import { NIA_RULESET, arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { SCENARIO_DELUXE, SCENARIO_SINGLE, SCENARIO_TWIN } from "@/fixtures/demo-policy";
import type { CalculationCase, RefusalCase } from "./fixtures";

export const RETRIEVAL_CASES_NIA: { question: string; expected: string }[] = [
  { question: "What is the room rent limit per day?", expected: "4.1(a)" },
  { question: "How much ICU expense is payable per day?", expected: "4.1(b)" },
  { question: "What happens if the room rate exceeds the limit?", expected: "4.1.1 Note (b)" },
  { question: "Is there a co-payment on every claim?", expected: "9.5" },
  { question: "What does co-payment mean?", expected: "3.11" },
  { question: "What counts as ICU charges?", expected: "3.27" },
  { question: "What does room rent include?", expected: "3.47" },
  { question: "Are surgeon and anaesthetist fees covered?", expected: "4.1(c)" },
  { question: "Are medicines, diagnostics and operation theatre charges covered?", expected: "4.1(d)" },
  { question: "What is the maximum the company pays in a policy year?", expected: "2" },
  { question: "Are medicines excepted from the proportionate reduction?", expected: "4.1.1 Note (b)" },
  { question: "Is nursing within the room rent limit?", expected: "4.1(a)" },
];

export const EXTRACTION_FIELDS_NIA: { field: string; expected: unknown; actual: (e: ExtractedRules) => unknown }[] = [
  { field: "roomLimit.clauseId", expected: NIA_RULESET.rules.roomLimit!.source.clauseId, actual: (e) => e.roomLimit?.clauseId },
  { field: "roomLimit.basis", expected: NIA_RULESET.rules.roomLimit!.basis, actual: (e) => e.roomLimit?.basis },
  { field: "icuLimit.clauseId", expected: NIA_RULESET.rules.icuLimit!.source.clauseId, actual: (e) => e.icuLimit?.clauseId },
  { field: "icuLimit.basis", expected: NIA_RULESET.rules.icuLimit!.basis, actual: (e) => e.icuLimit?.basis },
  { field: "proportionateDeduction.clauseId", expected: NIA_RULESET.rules.proportionateDeduction!.source.clauseId, actual: (e) => e.proportionateDeduction?.clauseId },
  { field: "proportionateDeduction.conditions", expected: [], actual: (e) => e.proportionateDeduction?.conditions },
  { field: "proportionateDeduction.triggers", expected: NIA_RULESET.rules.proportionateDeduction!.triggers, actual: (e) => e.proportionateDeduction?.triggers },
  { field: "copay.clauseId", expected: NIA_RULESET.rules.copay!.source.clauseId, actual: (e) => e.copay?.clauseId },
  { field: "copay.percent", expected: NIA_RULESET.rules.copay!.percent, actual: (e) => e.copay?.percent },
  { field: "sumInsuredCap.clauseId", expected: NIA_RULESET.rules.sumInsuredCap!.source.clauseId, actual: (e) => e.sumInsuredCap?.clauseId },
  { field: "itemClasses.included", expected: [...NIA_RULESET.rules.itemClasses!.included].sort(), actual: (e) => (e.itemClasses ? [...e.itemClasses.included].sort() : undefined) },
  { field: "itemClasses.excluded", expected: [...NIA_RULESET.rules.itemClasses!.excluded].sort(), actual: (e) => (e.itemClasses ? [...e.itemClasses.excluded].sort() : undefined) },
];

const item = (r: SimulationResult, id: string) => r.items.find((i) => i.itemId === id)?.deduction.value;
const itemHigh = (r: SimulationResult, id: string) => r.items.find((i) => i.itemId === id)?.deduction.range?.high;

export const CALCULATION_CASES_NIA: CalculationCase[] = [
  {
    name: "Arogya Sanjeevani, twin-sharing: ICU day triggers the proportion",
    inputs: arogyaInputs(),
    scenario: SCENARIO_TWIN,
    expect: [
      { field: "roomLimit", expected: rupees(5_000), read: (r) => r.roomLimit.eligiblePerDay },
      { field: "icuLimit", expected: rupees(10_000), read: (r) => r.icuLimit.eligiblePerDay },
      { field: "roomExcess", expected: 0, read: (r) => r.roomExcess.value },
      { field: "icuExcess", expected: rupees(5_000), read: (r) => r.icuExcess.value },
      { field: "surgeon", expected: rupees(20_000), read: (r) => item(r, "surgeon") },
      { field: "nursing", expected: 133_333, read: (r) => item(r, "nursing") },
      { field: "physio", expected: rupees(2_000), read: (r) => item(r, "physio") },
      { field: "implantHigh", expected: rupees(40_000), read: (r) => itemHigh(r, "implant") },
      { field: "calculatedDeductions", expected: rupees(45_000), read: (r) => r.totals.calculatedDeductions },
      { field: "copayLow", expected: rupees(9_800), read: (r) => r.copay.range?.low },
      { field: "copayHigh", expected: rupees(13_325), read: (r) => r.copay.range?.high },
      { field: "unclassified", expected: rupees(26_500), read: (r) => r.totals.unclassifiedAmount },
    ],
  },
  {
    name: "Arogya Sanjeevani, single private: room and ICU in the same proportion",
    inputs: arogyaInputs(),
    scenario: SCENARIO_SINGLE,
    expect: [
      { field: "roomExcess", expected: rupees(10_000), read: (r) => r.roomExcess.value },
      { field: "surgeon", expected: rupees(20_000), read: (r) => item(r, "surgeon") },
      { field: "calculatedDeductions", expected: rupees(55_000), read: (r) => r.totals.calculatedDeductions },
      { field: "copayLow", expected: rupees(9_900), read: (r) => r.copay.range?.low },
      { field: "copayHigh", expected: rupees(13_425), read: (r) => r.copay.range?.high },
    ],
  },
  {
    name: "Arogya Sanjeevani, deluxe: ambiguous ratio gives bounds, not a number",
    inputs: arogyaInputs(),
    scenario: SCENARIO_DELUXE,
    expect: [
      { field: "roomExcess", expected: rupees(28_000), read: (r) => r.roomExcess.value },
      { field: "surgeonLow", expected: rupees(20_000), read: (r) => r.items.find((i) => i.itemId === "surgeon")?.deduction.range?.low },
      { field: "surgeonHigh", expected: rupees(35_000), read: (r) => itemHigh(r, "surgeon") },
      { field: "surgeonValue", expected: null, read: (r) => item(r, "surgeon") ?? null },
    ],
  },
];

export const REFUSAL_CASES_NIA: RefusalCase[] = [
  {
    name: "Arogya Sanjeevani, deluxe: refuses to pick a ratio when room and ICU disagree",
    inputs: arogyaInputs(),
    scenario: SCENARIO_DELUXE,
    expectedOverall: "conditional",
    mustBeNull: [{ field: "surgeon.deduction.value", read: (r) => item(r, "surgeon") }, { field: "deductionRule.ratio", read: (r) => r.deductionRule.ratio }],
    expectedCodes: ["RATIO_AMBIGUOUS_ROOM_AND_ICU", "WORDING_PREDATES_2020_NORMS", "ITEM_NOT_CLASSIFIED"],
  },
  {
    name: "Arogya Sanjeevani, twin-sharing: implants and diagnostics need insurer confirmation; pharmacy stays unclassified",
    inputs: arogyaInputs(),
    scenario: SCENARIO_TWIN,
    expectedOverall: "conditional",
    mustBeNull: [{ field: "implant.deduction.value", read: (r) => item(r, "implant") }, { field: "pharmacy.deduction.value", read: (r) => item(r, "pharmacy") }, { field: "copay.value", read: (r) => r.copay.value }],
    expectedCodes: ["WORDING_PREDATES_2020_NORMS", "ITEM_NOT_CLASSIFIED", "POLICY_CAVEAT"],
  },
  {
    name: "Arogya Sanjeevani without a schedule: no limit, no deduction, no co-payment",
    inputs: { ...arogyaInputs(), schedule: null },
    scenario: SCENARIO_SINGLE,
    expectedOverall: "cannotDetermine",
    mustBeNull: [{ field: "roomExcess.value", read: (r) => r.roomExcess.value }, { field: "copay.value", read: (r) => r.copay.value }, { field: "surgeon.deduction.value", read: (r) => item(r, "surgeon") }],
    expectedCodes: ["SCHEDULE_MISSING"],
  },
];
