import { formatInr } from "@/lib/format-inr";
import { classifyItems } from "./classify";
import { evaluateDeduction } from "./deduction";
import { computeExcess, resolveLimit, type ResolvedLimit } from "./limits";
import { type Money, ZERO, add, sum, times } from "./money";
import type {
  CaseInputs,
  ClassifiedItem,
  ExcessResult,
  OverallState,
  Provenance,
  Scenario,
  SimulationResult,
  SimulationTotals,
  Trace,
  UncertaintyReason,
} from "./types";
import { ENGINE_VERSION } from "./types";

/** What this version of the engine does not model. Shown in the uncertainty panel so nobody mistakes the result for a total. */
export const NOT_MODELLED: readonly string[] = [
  "Co-payment clauses",
  "Sub-limits other than the room rent and ICU limits (disease- or procedure-specific limits, package rates)",
  "Exclusions and waiting periods",
  "Non-payable items and consumables lists",
  "Pre- and post-hospitalisation expenses",
  "Network, cashless and package-rate differences",
  "The Sum Insured cap, beyond a notice when the scenario total exceeds it",
];

function icuExcess(
  icuLimit: ResolvedLimit,
  items: ClassifiedItem[],
  estimateProvenance: Provenance,
  uncertainties: UncertaintyReason[],
): ExcessResult {
  const icuItems = items.filter((i) => i.classification === "icu");
  if (icuItems.length === 0) {
    if (icuLimit.state !== "calculated" || !icuLimit.trace) {
      return { state: "excluded", value: ZERO, trace: null };
    }
    const trace: Trace = {
      ruleId: icuLimit.trace.ruleId,
      ruleName: "ICU limit: amount above the limit",
      inputs: [{ name: "icuCharges", value: { kind: "money", paise: ZERO }, provenance: estimateProvenance }],
      source: icuLimit.trace.source,
      formula: `No ICU charges in this estimate; excess = ${formatInr(ZERO)}`,
      operation: "excess.noIcuCharges",
      output: { state: "calculated", value: ZERO },
      assumptions: [],
    };
    return { state: "calculated", value: ZERO, trace };
  }
  const withoutRate = icuItems.filter((i) => !i.perDay);
  if (withoutRate.length > 0) {
    uncertainties.push({
      code: "ICU_RATE_NOT_STATED",
      text: `The estimate does not state a per-day rate for ${withoutRate.map((i) => i.label).join(", ")}, so the ICU limit cannot be applied.`,
      affectedItemIds: withoutRate.map((i) => i.itemId),
      resolvableBy: "hospital",
      whatWouldResolveIt: "Ask the hospital for the ICU rate per day and the number of ICU days, then correct the estimate on Input review.",
    });
    return { state: "unknown", value: null, trace: null };
  }
  const parts = icuItems.map((item) =>
    computeExcess(icuLimit, item.perDay!.ratePerDay, item.perDay!.days, estimateProvenance, estimateProvenance),
  );
  if (parts.some((p) => p.state !== "calculated" || p.value === null || p.trace === null)) {
    return { state: icuLimit.state === "reviewRequired" ? "reviewRequired" : "unknown", value: null, trace: null };
  }
  if (parts.length === 1) {
    return parts[0];
  }
  const value = sum(parts.map((p) => p.value as Money));
  const first = parts[0].trace as Trace;
  const trace: Trace = {
    ...first,
    inputs: parts.flatMap((p) => (p.trace as Trace).inputs),
    formula: parts.map((p) => (p.trace as Trace).formula).join("; ") + ` → total ${formatInr(value)}`,
    operation: "excess.sumOfRateMinusEligibleTimesDays",
    output: { state: "calculated", value },
  };
  return { state: "calculated", value, trace };
}

function dedupe(reasons: UncertaintyReason[]): UncertaintyReason[] {
  const seen = new Set<string>();
  return reasons.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });
}

/** Runs one scenario through the policy's rules. Pure and deterministic. */
export function evaluate(inputs: CaseInputs, scenario: Scenario): SimulationResult {
  const { ruleset, schedule, estimate, confirmations } = inputs;
  const rulesetProvenance: Provenance = "fixture";

  const option = estimate.roomOptions.find((o) => o.roomId === scenario.roomId);
  if (!option) {
    throw new Error(`Scenario ${scenario.scenarioId} selects room "${scenario.roomId}", which the estimate does not offer`);
  }
  const ratePerDay = scenario.roomRatePerDay ?? option.ratePerDay;
  const rateProvenance: Provenance = scenario.roomRatePerDay !== undefined ? "userEntered" : estimate.provenance;

  const roomRent = times(ratePerDay, estimate.roomDays);
  const nonRoomItems = sum(estimate.items.map((i) => i.amount));
  const scenarioTotal = add(roomRent, nonRoomItems);

  const classified = classifyItems(ruleset, estimate.items, confirmations, rulesetProvenance);
  const uncertainties: UncertaintyReason[] = [];

  const roomLimit = resolveLimit("room", ruleset, schedule, rulesetProvenance);
  if (roomLimit.uncertainty) uncertainties.push(roomLimit.uncertainty);
  const roomExcess = computeExcess(roomLimit, ratePerDay, estimate.roomDays, rateProvenance, estimate.provenance);

  const icuLimit = resolveLimit("icu", ruleset, schedule, rulesetProvenance);
  if (icuLimit.uncertainty) uncertainties.push(icuLimit.uncertainty);
  const icuExcessResult = icuExcess(icuLimit, classified, estimate.provenance, uncertainties);

  const deduction = evaluateDeduction({
    ruleset,
    roomLimit,
    ratePerDay,
    rateProvenance,
    items: classified,
    differentialBilling: estimate.differentialBilling,
    estimateProvenance: estimate.provenance,
    confirmations,
    rulesetProvenance,
  });
  uncertainties.push(...deduction.uncertainties);

  const calculatedItemDeductions = sum(
    deduction.items.filter((i) => i.deduction.state === "calculated" && i.deduction.value !== null).map((i) => i.deduction.value as Money),
  );
  const calculatedDeductions = sum([
    roomExcess.state === "calculated" && roomExcess.value !== null ? roomExcess.value : ZERO,
    icuExcessResult.state === "calculated" && icuExcessResult.value !== null ? icuExcessResult.value : ZERO,
    calculatedItemDeductions,
  ]);
  const unknownItems = deduction.items.filter((i) => i.classification === "unknown");
  const totals: SimulationTotals = {
    roomRent,
    nonRoomItems,
    scenarioTotal,
    calculatedDeductions,
    conditionalDeductions: deduction.conditionalTotal,
    unclassifiedAmount: sum(unknownItems.map((i) => i.amount)),
    unclassifiedCount: unknownItems.length,
  };

  let overallState: OverallState;
  if (roomLimit.state === "reviewRequired") overallState = "reviewRequired";
  else if (roomLimit.state !== "calculated") overallState = "cannotDetermine";
  else if (deduction.rule.applicability === "conditional") overallState = "conditional";
  else overallState = "calculated";

  return {
    engineVersion: ENGINE_VERSION,
    fixtureVersion: ruleset.fixtureVersion,
    policy: {
      policyId: ruleset.metadata.policyId,
      name: ruleset.metadata.name,
      issuer: ruleset.metadata.issuer,
      wordingVersion: ruleset.metadata.wordingVersion,
    },
    scenario: {
      scenarioId: scenario.scenarioId,
      label: scenario.label,
      roomId: option.roomId,
      roomLabel: option.label,
      ratePerDay,
      roomDays: estimate.roomDays,
      rateProvenance,
    },
    roomLimit: { state: roomLimit.state, eligiblePerDay: roomLimit.eligiblePerDay, trace: roomLimit.trace },
    roomExcess,
    icuLimit: { state: icuLimit.state, eligiblePerDay: icuLimit.eligiblePerDay, trace: icuLimit.trace },
    icuExcess: icuExcessResult,
    deductionRule: deduction.rule,
    items: deduction.items,
    totals,
    uncertainties: dedupe(uncertainties),
    notModelled: [...NOT_MODELLED],
    overallState,
  };
}
