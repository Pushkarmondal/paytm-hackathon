/**
 * Deterministic rule extraction: regular expressions over clause text that
 * propose candidate rules for human review. Candidates never become
 * executable rules until a person confirms them (PRD §16, decision D2).
 */

import { paise } from "@/engine/money";
import type { BillCategory, Clause, LimitBasis, RuleCondition } from "@/engine/types";

export interface ExtractedRules {
  roomLimit?: { clauseId: string; basis: LimitBasis };
  icuLimit?: { clauseId: string; basis: LimitBasis };
  proportionateDeduction?: { clauseId: string; conditions: RuleCondition["conditionId"][] };
  itemClasses?: { clauseId: string; included: BillCategory[]; excluded: BillCategory[] };
  sumInsuredCap?: { clauseId: string };
}

const PERCENT_PER_DAY = /(\d+(?:\.\d+)?)\s*%\s*of\s*(?:the\s+)?sum\s+insured\s+per\s+day/i;
const FIXED_PER_DAY = /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*per\s+day/i;
const ROOM = /room\s+rent/i;
const ICU = /\bicu\b|intensive\s+care/i;
const PROPORTION = /same\s+proportion|in\s+proportion\s+to|proportionately\s+reduc/i;
const DIFFERENTIAL = /differential\s+billing/i;
const DEFINITION = /associated\s+medical\s+expenses?\s+means/i;
const EXCLUSION_SPLIT = /do(?:es)?\s+not\s+include/i;
const CAP = /shall\s+not\s+exceed\s+the\s+sum\s+insured/i;

const CATEGORY_PATTERNS: [RegExp, BillCategory][] = [
  [/nursing/i, "nursing"],
  [/surgeon/i, "surgeonFees"],
  [/an(?:a)?esthetist/i, "anaesthetistFees"],
  [/consultant|medical\s+practitioner|physician/i, "consultantFees"],
  [/operation\s+theat(?:re|er)|\bot\s+charges/i, "operationTheatre"],
  [/pharmacy|consumable/i, "pharmacyConsumables"],
  [/implant|medical\s+device/i, "implant"],
  [/diagnostic/i, "diagnostics"],
  [/\bicu\b|intensive\s+care/i, "icu"],
  [/physiotherapy/i, "physiotherapy"],
];

function limitBasis(text: string): LimitBasis | null {
  const pct = PERCENT_PER_DAY.exec(text);
  if (pct) return { kind: "percentOfSumInsuredPerDay", percent: Number(pct[1]) };
  const fixed = FIXED_PER_DAY.exec(text);
  if (fixed) {
    const [whole, frac = ""] = fixed[1].replace(/,/g, "").split(".");
    const amount = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
    if (Number.isSafeInteger(amount)) return { kind: "fixedPerDay", amount: paise(amount) };
  }
  return null;
}

function categoriesIn(text: string): BillCategory[] {
  const found: BillCategory[] = [];
  for (const [re, category] of CATEGORY_PATTERNS) {
    if (re.test(text) && !found.includes(category)) found.push(category);
  }
  return found;
}

export function extractRules(clauses: readonly Clause[]): ExtractedRules {
  const out: ExtractedRules = {};
  for (const clause of clauses) {
    const text = clause.text;
    const basis = limitBasis(text);
    if (basis && ICU.test(text) && !out.icuLimit) {
      out.icuLimit = { clauseId: clause.id, basis };
    } else if (basis && ROOM.test(text) && !out.roomLimit) {
      out.roomLimit = { clauseId: clause.id, basis };
    }
    if (PROPORTION.test(text) && !out.proportionateDeduction) {
      out.proportionateDeduction = { clauseId: clause.id, conditions: DIFFERENTIAL.test(text) ? ["hospitalFollowsDifferentialBilling"] : [] };
    }
    if (DEFINITION.test(text) && !out.itemClasses) {
      const [includedText, excludedText = ""] = text.split(EXCLUSION_SPLIT);
      out.itemClasses = { clauseId: clause.id, included: categoriesIn(includedText), excluded: categoriesIn(excludedText) };
    }
    if (CAP.test(text) && !out.sumInsuredCap) {
      out.sumInsuredCap = { clauseId: clause.id };
    }
  }
  return out;
}
