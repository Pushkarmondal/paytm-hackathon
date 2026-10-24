import { formatInr } from "@/lib/format-inr";
import { type Money, max0, mulRatio, percentToRatio, sub, times } from "./money";
import type {
  ExcessResult,
  LimitResult,
  LimitRule,
  PolicyRuleset,
  PolicySchedule,
  Provenance,
  Trace,
  TraceInput,
  UncertaintyReason,
} from "./types";

export interface ResolvedLimit extends LimitResult {
  uncertainty: UncertaintyReason | null;
  rule: LimitRule | null;
}

const LABEL: Record<"room" | "icu", string> = { room: "room rent", icu: "ICU" };

function unknown(
  rule: LimitRule | null,
  state: LimitResult["state"],
  uncertainty: UncertaintyReason,
): ResolvedLimit {
  return { state, eligiblePerDay: null, trace: null, uncertainty, rule };
}

/** The per-day limit the policy sets for the room (or ICU), or an explicit inability to determine it. */
export function resolveLimit(
  kind: "room" | "icu",
  ruleset: PolicyRuleset,
  schedule: PolicySchedule | null,
  rulesetProvenance: Provenance = "fixture",
): ResolvedLimit {
  const rule = kind === "room" ? ruleset.rules.roomLimit : ruleset.rules.icuLimit;
  if (!rule) {
    return unknown(null, "unknown", {
      code: "LIMIT_RULE_ABSENT",
      text: `The ruleset for this wording has no ${LABEL[kind]} limit rule, so no ${LABEL[kind]} limit can be applied.`,
      affectedItemIds: [],
      resolvableBy: "user",
      whatWouldResolveIt: `Review the wording for a ${LABEL[kind]} limit clause and encode it in the ruleset.`,
    });
  }
  if (!schedule) {
    return unknown(rule, "unknown", {
      code: "SCHEDULE_MISSING",
      text: `The policy schedule is missing. The ${LABEL[kind]} limit depends on the Sum Insured stated in the schedule, so it cannot be determined.`,
      affectedItemIds: [],
      resolvableBy: "user",
      whatWouldResolveIt: "Add the policy schedule on Input review.",
    });
  }

  const stated = kind === "room" ? schedule.roomLimitPerDay : schedule.icuLimitPerDay;
  const inputs: TraceInput[] = [];
  let computed: Money;
  let operation: string;
  let formula: string;

  switch (rule.basis.kind) {
    case "percentOfSumInsuredPerDay": {
      computed = mulRatio(schedule.sumInsured, percentToRatio(rule.basis.percent));
      operation = "limit.percentOfSumInsuredPerDay";
      formula = `eligiblePerDay = ${rule.basis.percent}% × ${formatInr(schedule.sumInsured)} = ${formatInr(computed)} per day`;
      inputs.push(
        { name: "sumInsured", value: { kind: "money", paise: schedule.sumInsured }, provenance: schedule.provenance },
        { name: "percentPerDay", value: { kind: "percent", percent: rule.basis.percent }, provenance: rulesetProvenance },
      );
      break;
    }
    case "fixedPerDay": {
      computed = rule.basis.amount;
      operation = "limit.fixedPerDay";
      formula = `eligiblePerDay = ${formatInr(computed)} per day (fixed by the wording)`;
      inputs.push({ name: "fixedPerDay", value: { kind: "money", paise: computed }, provenance: rulesetProvenance });
      break;
    }
    case "scheduleDefined": {
      if (!stated) {
        return unknown(rule, "unknown", {
          code: "SCHEDULE_MISSING",
          text: `The wording leaves the ${LABEL[kind]} limit to the policy schedule, and the schedule provided does not state one.`,
          affectedItemIds: [],
          resolvableBy: "user",
          whatWouldResolveIt: `Enter the ${LABEL[kind]} limit printed on the schedule on Input review.`,
        });
      }
      computed = stated.amountPerDay;
      operation = "limit.scheduleDefined";
      formula = `eligiblePerDay = ${formatInr(computed)} per day (stated on the schedule)`;
      break;
    }
  }

  if (stated) {
    inputs.push(
      { name: "scheduleStatedLimit", value: { kind: "money", paise: stated.amountPerDay }, provenance: schedule.provenance },
      { name: "scheduleText", value: { kind: "text", text: stated.source.quotedText }, provenance: schedule.provenance },
    );
    if (stated.amountPerDay !== computed) {
      return unknown(rule, "reviewRequired", {
        code: "SCHEDULE_CONTRADICTS_WORDING",
        text: `The schedule states a ${LABEL[kind]} limit of ${formatInr(stated.amountPerDay)} per day, but the wording gives ${formatInr(computed)} per day. The documents contradict each other, so no limit is applied until this is resolved.`,
        affectedItemIds: [],
        resolvableBy: "insurer",
        whatWouldResolveIt: "Ask the insurer which figure governs, then correct the schedule or the ruleset on Input review.",
      });
    }
  }

  const trace: Trace = {
    ruleId: rule.ruleId,
    ruleName: `${LABEL[kind] === "ICU" ? "ICU" : "Room rent"} limit`,
    inputs,
    source: rule.source,
    formula,
    operation,
    output: { state: "calculated", value: computed },
    assumptions: [],
  };
  return { state: "calculated", eligiblePerDay: computed, trace, uncertainty: null, rule };
}

/** The amount by which a per-day charge exceeds the limit, over the stated days. Unknown when the limit is unknown. */
export function computeExcess(
  limit: ResolvedLimit | LimitResult,
  ratePerDay: Money,
  days: number,
  rateProvenance: Provenance,
  daysProvenance: Provenance = "fixture",
): ExcessResult {
  if (limit.state !== "calculated" || limit.eligiblePerDay === null || limit.trace === null) {
    return { state: limit.state === "reviewRequired" ? "reviewRequired" : "unknown", value: null, trace: null };
  }
  const perDay = max0(sub(ratePerDay, limit.eligiblePerDay));
  const value = times(perDay, days);
  const trace: Trace = {
    ruleId: limit.trace.ruleId,
    ruleName: `${limit.trace.ruleName}: amount above the limit`,
    inputs: [
      { name: "ratePerDay", value: { kind: "money", paise: ratePerDay }, provenance: rateProvenance },
      { name: "eligiblePerDay", value: { kind: "money", paise: limit.eligiblePerDay }, provenance: limit.trace.inputs[0]?.provenance ?? "fixture" },
      { name: "days", value: { kind: "days", days }, provenance: daysProvenance },
    ],
    source: limit.trace.source,
    formula: `excess = max(0, ${formatInr(ratePerDay)} − ${formatInr(limit.eligiblePerDay)}) × ${days} day${days === 1 ? "" : "s"} = ${formatInr(value)}`,
    operation: "excess.rateMinusEligibleTimesDays",
    output: { state: "calculated", value },
    assumptions: [],
  };
  return { state: "calculated", value, trace };
}
