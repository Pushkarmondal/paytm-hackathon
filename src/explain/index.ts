/**
 * Explanations. The deterministic explainer turns a trace into plain words;
 * it is the only explainer the demo uses. The LlmAdapter interface is the
 * optional path from PRD §16 decision D2: off by default, never an authority,
 * never given personal data, and always accompanied by the deterministic text.
 */

import type { Trace, TraceInput } from "@/engine/types";
import { formatInr } from "@/lib/format-inr";

function input(trace: Trace, name: string): TraceInput | undefined {
  return trace.inputs.find((i) => i.name === name);
}

function money(trace: Trace, name: string): string {
  const v = input(trace, name)?.value;
  if (!v || v.kind !== "money") return "an unknown amount";
  return formatInr(v.paise, { paise: v.paise % 100 !== 0 });
}

function out(trace: Trace): string {
  const v = trace.output.value;
  return v === null ? "an unknown amount" : formatInr(v, { paise: v % 100 !== 0 });
}

function ratioText(trace: Trace): string {
  return `${money(trace, "eligiblePerDay")} ÷ ${money(trace, "ratePerDay")}`.replace(/₹/g, "");
}

export function explainTrace(trace: Trace): string {
  const clause = `clause ${trace.source.clauseId}`;
  const page = `page ${trace.source.page}`;
  const subject = input(trace, "itemAmount") ? "this item" : "the associated medical expenses";
  switch (trace.operation) {
    case "limit.percentOfSumInsuredPerDay": {
      const pct = input(trace, "percentPerDay")?.value;
      const percent = pct && pct.kind === "percent" ? `${pct.percent}%` : "a percentage";
      return `The ${trace.ruleName.toLowerCase()} is ${percent} of the sum insured per day: ${out(trace)} per day (${clause}, ${page}).`;
    }
    case "limit.fixedPerDay":
      return `The ${trace.ruleName.toLowerCase()} is a fixed ${out(trace)} per day (${clause}, ${page}).`;
    case "limit.scheduleDefined":
      return `The ${trace.ruleName.toLowerCase()} is the ${out(trace)} per day printed on the policy schedule, which ${clause} refers to.`;
    case "excess.rateMinusEligibleTimesDays": {
      const days = input(trace, "days")?.value;
      const dayText = days && days.kind === "days" ? `${days.days} day${days.days === 1 ? "" : "s"}` : "the stay";
      if (trace.output.value === 0) {
        return `The chosen rate of ${money(trace, "ratePerDay")} per day is within the eligible ${money(trace, "eligiblePerDay")} per day, so nothing is above the limit (${clause}).`;
      }
      return `The chosen rate of ${money(trace, "ratePerDay")} per day exceeds the eligible ${money(trace, "eligiblePerDay")} per day; over ${dayText} the amount above the limit is ${out(trace)} (${clause}, ${page}).`;
    }
    case "excess.noIcuCharges":
      return `This estimate has no ICU charges, so the ICU limit in ${clause} leaves nothing above the limit.`;
    case "excess.sumOfRateMinusEligibleTimesDays":
      return `Across the ICU lines, the amounts above the eligible rate add up to ${out(trace)} (${clause}).`;
    case "deduction.withinEntitlement":
      return `The chosen rate of ${money(trace, "ratePerDay")} per day is within the eligible ${money(trace, "eligiblePerDay")} per day, so ${clause} applies no proportionate deduction.`;
    case "deduction.conditionFailed":
      return `The hospital does not follow differential billing by room category, so ${clause} does not apply and nothing is deducted here.`;
    case "deduction.itemTimesOneMinusRatio": {
      if (trace.output.state === "conditional" && trace.output.range) {
        const low = formatInr(trace.output.range.low);
        const high = formatInr(trace.output.range.high, { paise: trace.output.range.high % 100 !== 0 });
        return `If the hospital follows differential billing by room category, ${clause} pays ${subject} in the proportion ${ratioText(trace)} (eligible ÷ actual room rate), which would deduct ${high}. Until that is established, the deduction is between ${low} and ${high}.`;
      }
      return `Under ${clause}, ${subject} is paid in the proportion ${ratioText(trace)} (eligible ÷ actual room rate), so the deduction is ${out(trace)} (${page}).`;
    }
    case "deduction.excludedByDefinition": {
      const cls = input(trace, "classification")?.value;
      if (cls && cls.kind === "text" && cls.text === "roomRent") {
        return `Room rent is governed by the room rent limit in ${clause}, not by the proportionate deduction.`;
      }
      return `This item is kept out of the proportionate deduction by ${clause}, so nothing is deducted from it here.`;
    }
    case "deduction.excludedByUser":
      return "You classified this item as not subject to the deduction, so nothing is deducted from it here. That is your assumption, not the wording's.";
    case "deduction.ruleAbsent":
      return "This wording's ruleset has no proportionate deduction clause, so none is applied. If the wording has one that was not encoded, this result is incomplete.";
    default:
      return trace.formula;
  }
}

export interface LlmAdapter {
  name: string;
  available: boolean;
  /** Prose for an already computed trace. Receives the trace only: public wording text and computed numbers, never personal data. */
  explain(trace: Trace): Promise<string | null>;
}

export const nullAdapter: LlmAdapter = {
  name: "none",
  available: false,
  explain: async () => null,
};

export interface Explanation {
  text: string;
  source: "deterministic" | "adapter";
  deterministic: string;
}

/** Deterministic text always; adapter prose only when the adapter is on and answers, and never without the deterministic text beside it. */
export async function explainWith(adapter: LlmAdapter, trace: Trace): Promise<Explanation> {
  const deterministic = explainTrace(trace);
  if (!adapter.available) return { text: deterministic, source: "deterministic", deterministic };
  try {
    const text = await adapter.explain(trace);
    if (text && text.trim().length > 0) return { text, source: "adapter", deterministic };
  } catch {
    // The adapter is optional; a failure must never hide the deterministic explanation.
  }
  return { text: deterministic, source: "deterministic", deterministic };
}
