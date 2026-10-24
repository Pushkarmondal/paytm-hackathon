import type { Range, SimulationResult, UncertaintyCode, UncertaintyReason } from "@/engine/types";
import { formatInr } from "@/lib/format-inr";
import { headlineFor } from "./index";

export interface Question {
  code: UncertaintyCode;
  question: string;
  why: string;
  clauseId?: string;
  atStake?: Range;
  itemLabels: string[];
}

export interface QuestionSheet {
  hospital: Question[];
  insurer: Question[];
  you: Question[];
}

export const DISCLAIMER_TEXT =
  "This is a scenario estimate of the potential deductions covered by this simulation, based on the inputs shown. It is not your total out-of-pocket cost. It is not a guarantee of coverage, not a claim decision, and not advice. Your insurer's final determination may differ. Confirm with your insurer and hospital before admission.";

function labels(result: SimulationResult, ids: string[]): string[] {
  return ids.map((id) => result.items.find((i) => i.itemId === id)?.label ?? id);
}

function deductionClause(result: SimulationResult): string | undefined {
  return result.deductionRule.trace?.source.clauseId ?? result.items.find((i) => i.trace && i.classification === "includedInDeduction")?.trace?.source.clauseId;
}

function classClause(result: SimulationResult): string | undefined {
  return result.items.find((i) => i.classification === "includedInDeduction" && i.classificationSource)?.classificationSource?.clauseId;
}

function build(result: SimulationResult, r: UncertaintyReason): { groups: ("hospital" | "insurer" | "you")[]; q: Question } {
  const names = labels(result, r.affectedItemIds);
  const list = names.join(", ");
  const base: Question = { code: r.code, question: r.whatWouldResolveIt, why: r.text, atStake: r.amountAtStake, itemLabels: names };
  switch (r.code) {
    case "DIFFERENTIAL_BILLING_NOT_ESTABLISHED":
      return { groups: ["hospital"], q: { ...base, clauseId: deductionClause(result), question: "Does the hospital bill differently by room category (differential billing), so that the rates of the associated items depend on the room chosen?" } };
    case "WORDING_SILENT_ON_ROOM_UNAVAILABILITY":
      return { groups: ["insurer"], q: { ...base, clauseId: deductionClause(result), question: "If the eligible room category is unavailable at admission and a higher category is taken, will the proportionate deduction be waived?" } };
    case "RATIO_AMBIGUOUS_ROOM_AND_ICU":
      return { groups: ["insurer"], q: { ...base, clauseId: deductionClause(result), question: "When both the room rate and the ICU rate exceed their limits in different proportions, which ratio does the insurer apply to the other expenses?" } };
    case "WORDING_PREDATES_2020_NORMS":
      return { groups: ["insurer"], q: { ...base, clauseId: classClause(result), question: `Under the current version of this policy, does the proportionate reduction apply to ${list}?` } };
    case "ITEM_NOT_CLASSIFIED":
      return { groups: ["you", "insurer"], q: { ...base, clauseId: classClause(result), question: `How does the policy treat ${list}: as expenses the proportionate deduction touches, as excluded from it, or as not payable at all?` } };
    case "POLICY_CAVEAT":
      return { groups: ["hospital", "you"], q: { ...base, question: r.whatWouldResolveIt } };
    case "ICU_RATE_NOT_STATED":
      return { groups: ["hospital"], q: { ...base, question: "What is the ICU rate per day and how many ICU days are planned?" } };
    case "SCHEDULE_CONTRADICTS_WORDING":
      return { groups: ["insurer", "you"], q: { ...base, question: "The schedule and the wording state different per-day limits. Which figure governs?" } };
    case "SCHEDULE_MISSING":
    case "RULE_ABSENT":
    case "LIMIT_RULE_ABSENT":
      return { groups: ["you"], q: base };
  }
}

/** Questions for the hospital, the insurer and the user, derived from the open uncertainties. */
export function questionSheet(result: SimulationResult): QuestionSheet {
  const sheet: QuestionSheet = { hospital: [], insurer: [], you: [] };
  for (const r of result.uncertainties) {
    const { groups, q } = build(result, r);
    for (const g of groups) sheet[g].push(q);
  }
  return sheet;
}

function block(title: string, questions: Question[]): string[] {
  const lines = [title, "".padEnd(title.length, "-")];
  if (questions.length === 0) lines.push("Nothing open.");
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question}`);
    if (q.clauseId) lines.push(`   Clause: ${q.clauseId}`);
    if (q.itemLabels.length) lines.push(`   Affects: ${q.itemLabels.join(", ")}`);
    if (q.atStake) lines.push(`   At stake: ${formatInr(q.atStake.low)} to ${formatInr(q.atStake.high)}`);
    lines.push(`   Why: ${q.why}`);
  });
  lines.push("");
  return lines;
}

/** Plain text for copying or printing. */
export function questionSheetText(sheet: QuestionSheet, result: SimulationResult): string {
  const head = headlineFor(result);
  const lines = [
    "Claim Sach question sheet",
    `Policy: ${result.policy.name}`,
    `Room: ${result.scenario.roomLabel}, ${formatInr(result.scenario.ratePerDay)} per day, ${result.scenario.roomDays} days`,
    `Potential deductions covered by this simulation: ${head.summary}`,
    "",
    ...block("Ask the hospital", sheet.hospital),
    ...block("Ask the insurer", sheet.insurer),
    ...block("For you", sheet.you),
    DISCLAIMER_TEXT,
  ];
  return lines.join("\n");
}
