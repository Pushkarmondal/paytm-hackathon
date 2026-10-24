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
  proportionateDeduction?: { clauseId: string; conditions: RuleCondition["conditionId"][]; triggers: ("room" | "icu")[] };
  itemClasses?: { clauseId: string; included: BillCategory[]; excluded: BillCategory[] };
  copay?: { clauseId: string; percent: number };
  sumInsuredCap?: { clauseId: string };
}

const PERCENT_OF_SI = /(\d+(?:\.\d+)?)\s*%\s*of\s*(?:the\s+)?sum\s+insured/i;
const PER_DAY = /per\s+day/i;
const CAP_PER_DAY = /subject\s+to\s+(?:a\s+)?maximum\s+of\s+(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*\/?-?\s*,?\s*per\s+day/i;
const FIXED_PER_DAY = /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*\/?-?\s*,?\s*per\s+day/i;
const ROOM = /room\s+rent/i;
const ICU = /\bicu\b|intensive\s+care/i;
const PROPORTION = /same\s+proportion|in\s+proportion\s+to|proportionately\s+reduc/i;
const DIFFERENTIAL = /differential\s+billing/i;
const DEFINITION = /associated\s+medical\s+expenses?\s+means/i;
const EXCLUSION_SPLIT = /do(?:es)?\s+not\s+include/i;
const ALL_OTHER = /all\s+other\s+expenses/i;
const EXCEPTION = /with\s+the\s+exception\s+of\s+(.+?)(?:,|\.|\s+shall)/i;
const COPAY = /co-?\s?payment\s+of\s+(\d+(?:\.\d+)?)\s*%/i;
const CAP = /shall\s+not\s+exceed\s+the\s+sum\s+insured|maximum\s+liability\s+of\s+the\s+company[^.]*shall\s+be\s+the\s+sum\s+insured/i;

const ALL_CATEGORIES: BillCategory[] = ["nursing", "surgeonFees", "anaesthetistFees", "consultantFees", "operationTheatre", "implant", "pharmacyConsumables", "diagnostics", "physiotherapy", "hospitalAdmin"];

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

function rupeesText(text: string): number | null {
  const [whole, frac = ""] = text.replace(/,/g, "").split(".");
  const amount = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(amount) ? amount : null;
}

function limitBasis(text: string): LimitBasis | null {
  if (!PER_DAY.test(text)) return null;
  const pct = PERCENT_OF_SI.exec(text);
  if (pct) {
    const cap = CAP_PER_DAY.exec(text);
    const capAmount = cap ? rupeesText(cap[1]) : null;
    return capAmount !== null ? { kind: "percentOfSumInsuredPerDay", percent: Number(pct[1]), capPerDay: paise(capAmount) } : { kind: "percentOfSumInsuredPerDay", percent: Number(pct[1]) };
  }
  const fixed = FIXED_PER_DAY.exec(text);
  if (fixed) {
    const amount = rupeesText(fixed[1]);
    if (amount !== null) return { kind: "fixedPerDay", amount: paise(amount) };
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
      out.proportionateDeduction = {
        clauseId: clause.id,
        conditions: DIFFERENTIAL.test(text) ? ["hospitalFollowsDifferentialBilling"] : [],
        triggers: ICU.test(text) ? ["room", "icu"] : ["room"],
      };
      if (ALL_OTHER.test(text) && !out.itemClasses) {
        const exception = EXCEPTION.exec(text);
        const excluded = exception ? categoriesIn(exception[1].replace(/medicines?/i, "pharmacy")) : [];
        out.itemClasses = { clauseId: clause.id, included: ALL_CATEGORIES.filter((c) => !excluded.includes(c)), excluded };
      }
    }
    if (DEFINITION.test(text) && !out.itemClasses) {
      const [includedText, excludedText = ""] = text.split(EXCLUSION_SPLIT);
      out.itemClasses = { clauseId: clause.id, included: categoriesIn(includedText), excluded: categoriesIn(excludedText) };
    }
    const copay = COPAY.exec(text);
    if (copay && !out.copay) {
      out.copay = { clauseId: clause.id, percent: Number(copay[1]) };
    }
    if (CAP.test(text) && !out.sumInsuredCap) {
      out.sumInsuredCap = { clauseId: clause.id };
    }
  }
  return out;
}
