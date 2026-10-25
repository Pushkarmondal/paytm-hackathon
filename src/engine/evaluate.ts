import { formatInr } from "@/lib/format-inr";
import { classifyItems } from "./classify";
import { type DeductionWorld, type WorldOutcome, evaluateDeduction, product } from "./deduction";
import { computeExcess, resolveLimit, type ResolvedLimit } from "./limits";
import { type Money, ZERO, add, mulRatio, percentToRatio, sub, sum, times } from "./money";
import type {
  CaseInputs,
  ClassifiedItem,
  CopayResult,
  ExcessResult,
  ItemResult,
  OverallState,
  PolicyRuleset,
  Provenance,
  Range,
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
    const key = `${r.code}:${r.affectedItemIds.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function noticesFor(ruleset: PolicyRuleset, items: ClassifiedItem[]): UncertaintyReason[] {
  return (ruleset.notices ?? []).flatMap((n) => {
    const affected = items.filter((i) => n.affectedCategories.includes(i.category)).map((i) => i.itemId);
    return affected.length ? [{ code: n.code, text: n.text, affectedItemIds: affected, resolvableBy: n.resolvableBy, whatWouldResolveIt: n.whatWouldResolveIt }] : [];
  });
}

/**
 * One jointly possible outcome of every open question in the scenario: the deduction world (differential billing,
 * ambiguous ratio, caveats) crossed with whether each unclassified item turns out to be admissible.
 */
interface JointWorld {
  outcomes: WorldOutcome[];
  /** Deductions on the items whose state is conditional, in this world. */
  conditionalItems: Money;
  /** Amount of unclassified items treated as not admissible in this world. */
  inadmissible: Money;
}

const MAX_ENUMERATED_UNKNOWN_ITEMS = 8;

/** Crosses the deduction worlds with the admissibility of each unclassified item. Beyond eight such items only the two extremes are enumerated. */
function jointWorlds(deductionWorlds: DeductionWorld[], items: ItemResult[]): JointWorld[] {
  const conditional = items.filter((i) => i.deduction.state === "conditional");
  const unknown = items.filter((i) => i.deduction.state === "unknown");
  const perItem = unknown.length <= MAX_ENUMERATED_UNKNOWN_ITEMS;
  const groups = perItem ? unknown.map((i) => [i]) : unknown.length ? [unknown] : [];
  const admissibility = product(
    groups.map((g) => {
      const label = g.map((i) => i.label).join(", ");
      return [
        { label: `${label} not admissible`, inadmissible: sum(g.map((i) => i.amount)) },
        { label: `${label} admissible`, inadmissible: ZERO },
      ];
    }),
  );
  return deductionWorlds.flatMap((w) =>
    admissibility.map((adm) => ({
      outcomes: [...w.outcomes, ...adm.map((o) => ({ code: "ITEM_NOT_CLASSIFIED" as const, label: o.label }))],
      conditionalItems: sum(conditional.map((i) => w.itemDeductions[i.itemId] ?? ZERO)),
      inadmissible: sum(adm.map((o) => o.inadmissible)),
    })),
  );
}

const describe = (w: { outcomes: WorldOutcome[] }) => (w.outcomes.length ? w.outcomes.map((o) => o.label).join("; ") : "nothing open");

interface CopayArgs {
  ruleset: PolicyRuleset;
  limitsKnown: boolean;
  scenarioTotal: Money;
  roomExcess: ExcessResult;
  icuExcess: ExcessResult;
  items: ItemResult[];
  worlds: JointWorld[];
  reasons: UncertaintyReason[];
  rulesetProvenance: Provenance;
}

/** The co-payment in one joint world: a percentage of what is admissible after every deduction that world implies. */
function copayIn(a: CopayArgs, settled: Money, w: JointWorld): Money {
  const rule = a.ruleset.rules.copay!;
  const base = sub(sub(sub(a.scenarioTotal, settled), w.conditionalItems), w.inadmissible);
  return mulRatio(base, percentToRatio(rule.percent));
}

/** Co-payment on the admissible amount: a single figure when everything is settled, otherwise the range over the jointly possible worlds. */
function evaluateCopay(a: CopayArgs): CopayResult {
  const rule = a.ruleset.rules.copay;
  if (!rule) return { state: "excluded", value: ZERO, trace: null };
  if (!a.limitsKnown || a.roomExcess.value === null || a.icuExcess.value === null) return { state: "unknown", value: null, trace: null };
  const calculated = sum(a.items.filter((i) => i.deduction.state === "calculated" && i.deduction.value !== null).map((i) => i.deduction.value as Money));
  const settled = sum([a.roomExcess.value, a.icuExcess.value, calculated]);
  const values = a.worlds.map((w) => ({ w, copay: copayIn(a, settled, w), base: sub(sub(sub(a.scenarioTotal, settled), w.conditionalItems), w.inadmissible) }));
  const lowest = values.reduce((m, v) => (v.copay < m.copay ? v : m));
  const highest = values.reduce((m, v) => (v.copay > m.copay ? v : m));
  const { copay: low, base: baseLow } = lowest;
  const { copay: high, base: baseHigh } = highest;
  const assumptions = a.reasons.filter((r) => ["ITEM_NOT_CLASSIFIED", "DIFFERENTIAL_BILLING_NOT_ESTABLISHED", "RATIO_AMBIGUOUS_ROOM_AND_ICU", "WORDING_PREDATES_2020_NORMS", "POLICY_CAVEAT"].includes(r.code) && (r.amountAtStake !== undefined || r.code === "ITEM_NOT_CLASSIFIED"));
  const common = { ruleId: rule.ruleId, ruleName: "Co-payment", source: rule.source, operation: "copay.percentOfAdmissible" as const };
  if (low === high) {
    const trace: Trace = {
      ...common,
      inputs: [
        { name: "copayPercent", value: { kind: "percent", percent: rule.percent }, provenance: a.rulesetProvenance },
        { name: "admissibleBase", value: { kind: "money", paise: baseHigh }, provenance: a.rulesetProvenance },
      ],
      formula: `co-pay = ${rule.percent}% × ${formatInr(baseHigh)} (scenario total less the deductions above) = ${formatInr(high)}`,
      output: { state: "calculated", value: high },
      assumptions: [],
    };
    return { state: "calculated", value: high, trace };
  }
  const basis = `Co-payment on the admissible amount, over every jointly possible outcome of the open questions: low when ${describe(lowest.w)}; high when ${describe(highest.w)}`;
  const range: Range = { low, high, basis };
  const trace: Trace = {
    ...common,
    inputs: [
      { name: "copayPercent", value: { kind: "percent", percent: rule.percent }, provenance: a.rulesetProvenance },
      { name: "admissibleBaseLow", value: { kind: "money", paise: baseLow }, provenance: a.rulesetProvenance },
      { name: "admissibleBaseHigh", value: { kind: "money", paise: baseHigh }, provenance: a.rulesetProvenance },
    ],
    formula: `co-pay = ${rule.percent}% × admissible amount, between ${formatInr(baseLow)} and ${formatInr(baseHigh)} = ${formatInr(low)} to ${formatInr(high)}`,
    output: { state: "conditional", value: null, range },
    assumptions: assumptions.length ? assumptions : [{ code: "ITEM_NOT_CLASSIFIED", text: "The admissible amount depends on open items.", affectedItemIds: [], resolvableBy: "user", whatWouldResolveIt: "Resolve the open items on Input review." }],
  };
  return { state: "conditional", value: null, range, trace };
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
    icuLimit,
    ratePerDay,
    rateProvenance,
    items: classified,
    differentialBilling: estimate.differentialBilling,
    estimateProvenance: estimate.provenance,
    confirmations,
    rulesetProvenance,
  });
  uncertainties.push(...deduction.uncertainties);
  uncertainties.push(...noticesFor(ruleset, classified));

  const worlds = jointWorlds(deduction.worlds, deduction.items);
  const copayArgs: CopayArgs = {
    ruleset,
    limitsKnown: roomLimit.state === "calculated",
    scenarioTotal,
    roomExcess,
    icuExcess: icuExcessResult,
    items: deduction.items,
    worlds,
    reasons: uncertainties,
    rulesetProvenance,
  };
  const copay = evaluateCopay(copayArgs);

  const calculatedItemDeductions = sum(
    deduction.items.filter((i) => i.deduction.state === "calculated" && i.deduction.value !== null).map((i) => i.deduction.value as Money),
  );
  const calculatedDeductions = sum([
    roomExcess.state === "calculated" && roomExcess.value !== null ? roomExcess.value : ZERO,
    icuExcessResult.state === "calculated" && icuExcessResult.value !== null ? icuExcessResult.value : ZERO,
    calculatedItemDeductions,
    copay.state === "calculated" && copay.value !== null ? copay.value : ZERO,
  ]);
  // Conditional deductions are bounded over jointly possible worlds: in each world the conditional items take one
  // value and the co-payment is computed on what that world leaves admissible. The bounds are then the smallest and
  // largest world totals, so no bound pairs a maximum deduction with a co-payment that ignores it.
  const hasConditionalItems = deduction.items.some((i) => i.deduction.state === "conditional");
  const copayOpen = copay.state === "conditional";
  let conditionalDeductions: Range | null = null;
  if (hasConditionalItems || copayOpen) {
    const settled = sum([
      roomExcess.value ?? ZERO,
      icuExcessResult.value ?? ZERO,
      calculatedItemDeductions,
    ]);
    const totals = worlds.map((w) => ({ w, total: add(w.conditionalItems, copayOpen ? copayIn(copayArgs, settled, w) : ZERO) }));
    const lowest = totals.reduce((m, t) => (t.total < m.total ? t : m));
    const highest = totals.reduce((m, t) => (t.total > m.total ? t : m));
    conditionalDeductions = {
      low: lowest.total,
      high: highest.total,
      basis: `Over every jointly possible outcome of the open questions (${worlds.length} in all): low when ${describe(lowest.w)}; high when ${describe(highest.w)}`,
    };
  }
  const unknownItems = deduction.items.filter((i) => i.classification === "unknown");
  const totals: SimulationTotals = {
    roomRent,
    nonRoomItems,
    scenarioTotal,
    calculatedDeductions,
    conditionalDeductions,
    unclassifiedAmount: sum(unknownItems.map((i) => i.amount)),
    unclassifiedCount: unknownItems.length,
  };

  let overallState: OverallState;
  if (roomLimit.state === "reviewRequired") overallState = "reviewRequired";
  else if (roomLimit.state !== "calculated") overallState = "cannotDetermine";
  else if (conditionalDeductions !== null) overallState = "conditional";
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
    copay,
    items: deduction.items,
    totals,
    uncertainties: dedupe(uncertainties),
    notModelled: [...NOT_MODELLED],
    overallState,
  };
}
