import { formatInr } from "@/lib/format-inr";
import type { ResolvedLimit } from "./limits";
import { type Money, type Ratio, ZERO, mulRatio, oneMinus, ratio, sum } from "./money";
import type {
  ClassifiedItem,
  Confirmations,
  DeductionRuleResult,
  DifferentialBillingStatement,
  ItemResult,
  PolicyCaveat,
  PolicyRuleset,
  Provenance,
  Range,
  SourceRef,
  Trace,
  TraceInput,
  TraceOutput,
  UncertaintyReason,
} from "./types";

export interface DeductionEvaluation {
  rule: DeductionRuleResult;
  items: ItemResult[];
  uncertainties: UncertaintyReason[];
  conditionalTotal: Range | null;
}

export interface DeductionArgs {
  ruleset: PolicyRuleset;
  roomLimit: ResolvedLimit;
  icuLimit: ResolvedLimit;
  ratePerDay: Money;
  rateProvenance: Provenance;
  items: ClassifiedItem[];
  differentialBilling: DifferentialBillingStatement;
  estimateProvenance: Provenance;
  confirmations: Confirmations;
  rulesetProvenance?: Provenance;
}

interface ConditionStatus {
  established: boolean | null;
  provenance: Provenance | null;
}

function conditionStatus(statement: DifferentialBillingStatement, estimateProvenance: Provenance, confirmations: Confirmations): ConditionStatus {
  const confirmed = confirmations.hospitalFollowsDifferentialBilling;
  if (confirmed !== undefined) return { established: confirmed, provenance: "userConfirmed" };
  if (statement === "yes") return { established: true, provenance: estimateProvenance };
  if (statement === "no") return { established: false, provenance: estimateProvenance };
  return { established: null, provenance: null };
}

function amountInput(item: ClassifiedItem, provenance: Provenance): TraceInput {
  return { name: "itemAmount", value: { kind: "money", paise: item.amount }, provenance };
}

function withResult(item: ClassifiedItem, deduction: TraceOutput, trace: Trace | null): ItemResult {
  return { ...item, deduction, trace };
}

function unknownItem(item: ClassifiedItem): ItemResult {
  return withResult(item, { state: "unknown", value: null }, null);
}

function excludedItem(item: ClassifiedItem, args: DeductionArgs): ItemResult {
  const source: SourceRef | null = item.classificationSource ?? args.ruleset.rules.proportionateDeduction?.source ?? args.ruleset.rules.itemClasses?.source ?? null;
  if (!source) return unknownItem(item);
  const byUser = item.classificationProvenance === "userConfirmed";
  const trace: Trace = {
    ruleId: args.ruleset.rules.itemClasses?.ruleId ?? "itemClasses",
    ruleName: item.classification === "roomRent" ? "Room rent is governed by the room rent limit" : "Excluded from the proportionate deduction",
    inputs: [
      amountInput(item, args.estimateProvenance),
      { name: "category", value: { kind: "text", text: item.category }, provenance: args.estimateProvenance },
      { name: "classification", value: { kind: "text", text: item.classification }, provenance: item.classificationProvenance },
    ],
    source,
    formula: byUser
      ? `${item.label}: excluded from the proportionate deduction on the user's classification; deduction = ${formatInr(ZERO)}`
      : item.classification === "roomRent"
        ? `${item.label}: governed by the room rent limit (${source.clauseId}), not by the proportionate deduction`
        : item.classification === "icu"
          ? `${item.label}: ICU charges are governed by the ICU limit (${source.clauseId}); deduction = ${formatInr(ZERO)}`
          : `${item.label}: not in the class the deduction touches under ${source.clauseId}; deduction = ${formatInr(ZERO)}`,
    operation: byUser ? "deduction.excludedByUser" : "deduction.excludedByDefinition",
    output: { state: "excluded", value: ZERO },
    assumptions: [],
  };
  return withResult(item, { state: "excluded", value: ZERO }, trace);
}

function unclassifiedReason(items: ClassifiedItem[], ruleset: PolicyRuleset): UncertaintyReason | null {
  const unknown = items.filter((i) => i.classification === "unknown");
  if (unknown.length === 0) return null;
  const notes = ruleset.rules.itemClasses?.notes ?? {};
  const noted = unknown.filter((i) => notes[i.category]);
  const plain = unknown.filter((i) => !notes[i.category]);
  const parts: string[] = [];
  if (plain.length) {
    const list = plain.map((i) => `${i.label} (${formatInr(i.amount)})`).join(" and ");
    parts.push(`The wording does not say whether ${list} count as expenses the deduction touches, and does not exclude them either.`);
  }
  for (const i of noted) parts.push(`${i.label} (${formatInr(i.amount)}): ${notes[i.category]}`);
  parts.push("These items are shown separately and are not part of any total.");
  return {
    code: "ITEM_NOT_CLASSIFIED",
    text: parts.join(" "),
    affectedItemIds: unknown.map((i) => i.itemId),
    resolvableBy: "user",
    whatWouldResolveIt: "Classify the item on Input review (recorded as your own assumption), or ask the insurer how it treats this charge.",
  };
}

function caveatsFor(ruleset: PolicyRuleset, item: ClassifiedItem): PolicyCaveat[] {
  return (ruleset.caveats ?? []).filter((c) => c.affectedCategories.includes(item.category));
}

/** Applies the policy's proportionate-deduction rule to the classified items, or explains why it cannot. */
export function evaluateDeduction(args: DeductionArgs): DeductionEvaluation {
  const rulesetProvenance = args.rulesetProvenance ?? "fixture";
  const rule = args.ruleset.rules.proportionateDeduction;
  const included = args.items.filter((i) => i.classification === "includedInDeduction");
  const uncertainties: UncertaintyReason[] = [];
  const unclassified = unclassifiedReason(args.items, args.ruleset);
  if (unclassified) uncertainties.push(unclassified);

  const finish = (ruleResult: DeductionRuleResult, includedResult: (item: ClassifiedItem) => ItemResult): DeductionEvaluation => {
    const items = args.items.map((item) => {
      switch (item.classification) {
        case "includedInDeduction":
          return includedResult(item);
        case "excludedFromDeduction":
        case "icu":
        case "roomRent":
          return excludedItem(item, args);
        case "unknown":
          return unknownItem(item);
      }
    });
    const conditional = items.filter((i) => i.deduction.state === "conditional" && i.deduction.range);
    const conditionalTotal: Range | null = conditional.length
      ? {
          low: sum(conditional.map((i) => i.deduction.range!.low)),
          high: sum(conditional.map((i) => i.deduction.range!.high)),
          basis: Array.from(new Set(conditional.map((i) => i.deduction.range!.basis))).join(" | "),
        }
      : null;
    return { rule: ruleResult, items, uncertainties, conditionalTotal };
  };

  if (!rule) {
    const source = args.ruleset.rules.roomLimit?.source ?? args.ruleset.rules.itemClasses?.source ?? null;
    const reason: UncertaintyReason = {
      code: "RULE_ABSENT",
      text: "The ruleset for this wording has no proportionate deduction clause, so no proportionate deduction is applied. If the wording contains one that was not encoded, this result is incomplete.",
      affectedItemIds: included.map((i) => i.itemId),
      resolvableBy: "user",
      whatWouldResolveIt: "Review the wording for a proportionate deduction clause and encode it in the ruleset.",
    };
    uncertainties.push(reason);
    const makeTrace = (inputs: TraceInput[]): Trace | null =>
      source
        ? {
            ruleId: "proportionateDeduction.absent",
            ruleName: "Proportionate deduction: no clause in this wording",
            inputs,
            source,
            formula: `This wording's ruleset has no proportionate deduction clause; deduction = ${formatInr(ZERO)}`,
            operation: "deduction.ruleAbsent",
            output: { state: "calculated", value: ZERO },
            assumptions: [reason],
          }
        : null;
    const ruleTrace = makeTrace([{ name: "wording", value: { kind: "text", text: `${args.ruleset.metadata.name}, wording ${args.ruleset.metadata.wordingVersion}` }, provenance: rulesetProvenance }]);
    return finish({ applicability: "ruleAbsent", ratio: null, trigger: null, trace: ruleTrace }, (item) => {
      const trace = makeTrace([amountInput(item, args.estimateProvenance)]);
      return trace ? withResult(item, { state: "calculated", value: ZERO }, trace) : unknownItem(item);
    });
  }

  const eligibleRoom = args.roomLimit.eligiblePerDay;
  if (args.roomLimit.state !== "calculated" || eligibleRoom === null) {
    return finish({ applicability: "undetermined", ratio: null, trigger: null, trace: null }, unknownItem);
  }

  const triggers = rule.triggers ?? ["room"];
  const limitProvenance = args.roomLimit.trace?.inputs[0]?.provenance ?? rulesetProvenance;
  const roomExceeds = triggers.includes("room") && args.ratePerDay > eligibleRoom;

  let icuRate: Money | null = null;
  const eligibleIcu = args.icuLimit.state === "calculated" ? args.icuLimit.eligiblePerDay : null;
  if (triggers.includes("icu") && eligibleIcu !== null) {
    for (const i of args.items) {
      if (i.classification === "icu" && i.perDay && i.perDay.ratePerDay > eligibleIcu) {
        icuRate = icuRate === null || i.perDay.ratePerDay > icuRate ? i.perDay.ratePerDay : icuRate;
      }
    }
  }
  const icuExceeds = icuRate !== null && eligibleIcu !== null;

  const baseInputs = (): TraceInput[] => {
    const inputs: TraceInput[] = [
      { name: "ratePerDay", value: { kind: "money", paise: args.ratePerDay }, provenance: args.rateProvenance },
      { name: "eligiblePerDay", value: { kind: "money", paise: eligibleRoom }, provenance: limitProvenance },
    ];
    if (icuExceeds && icuRate !== null && eligibleIcu !== null) {
      inputs.push(
        { name: "icuRatePerDay", value: { kind: "money", paise: icuRate }, provenance: args.estimateProvenance },
        { name: "icuEligiblePerDay", value: { kind: "money", paise: eligibleIcu }, provenance: limitProvenance },
      );
    }
    return inputs;
  };
  const ruleTrace = (extra: TraceInput[], formula: string, operation: string, output: TraceOutput, assumptions: UncertaintyReason[] = []): Trace => ({
    ruleId: rule.ruleId,
    ruleName: "Proportionate deduction",
    inputs: [...baseInputs(), ...extra],
    source: rule.source,
    formula,
    operation,
    output,
    assumptions,
  });

  if (!roomExceeds && !icuExceeds) {
    const formula = triggers.includes("icu")
      ? `${formatInr(args.ratePerDay)} per day is within the eligible ${formatInr(eligibleRoom)} per day and no ICU rate is above its limit: no proportionate deduction under ${rule.source.clauseId}; deduction = ${formatInr(ZERO)}`
      : `${formatInr(args.ratePerDay)} per day is within the eligible ${formatInr(eligibleRoom)} per day: no proportionate deduction under ${rule.source.clauseId}; deduction = ${formatInr(ZERO)}`;
    return finish(
      { applicability: "withinEntitlement", ratio: null, trigger: null, trace: ruleTrace([], formula, "deduction.withinEntitlement", { state: "calculated", value: ZERO }) },
      (item) => withResult(item, { state: "calculated", value: ZERO }, ruleTrace([amountInput(item, args.estimateProvenance)], formula, "deduction.withinEntitlement", { state: "calculated", value: ZERO })),
    );
  }

  const trigger: "room" | "icu" | "both" = roomExceeds && icuExceeds ? "both" : roomExceeds ? "room" : "icu";
  const roomRatio: Ratio | null = roomExceeds ? ratio(eligibleRoom, args.ratePerDay) : null;
  const icuRatio: Ratio | null = icuExceeds && icuRate !== null && eligibleIcu !== null ? ratio(eligibleIcu, icuRate) : null;
  const ratios = [roomRatio, icuRatio].filter((r): r is Ratio => r !== null);
  const ambiguous = ratios.length === 2 && (ratios[0].num !== ratios[1].num || ratios[0].den !== ratios[1].den);
  const keep: Ratio | null = ambiguous ? null : ratios[0];
  const ratioText = (r: Ratio, kind: "room" | "icu") =>
    kind === "room"
      ? `${formatInr(eligibleRoom)} ÷ ${formatInr(args.ratePerDay)}`.replace(/₹/g, "")
      : `${formatInr(eligibleIcu as Money)} ÷ ${formatInr(icuRate as Money)}`.replace(/₹/g, "");
  const keepText = keep ? ratioText(keep, trigger === "icu" ? "icu" : "room") : `${ratioText(roomRatio as Ratio, "room")} (room) or ${ratioText(icuRatio as Ratio, "icu")} (ICU)`;

  const needsCondition = rule.conditions.some((c) => c.conditionId === "hospitalFollowsDifferentialBilling");
  const condition: ConditionStatus = needsCondition ? conditionStatus(args.differentialBilling, args.estimateProvenance, args.confirmations) : { established: true, provenance: rulesetProvenance };

  if (roomExceeds && !args.ruleset.rules.roomUnavailabilityClause) {
    uncertainties.push({
      code: "WORDING_SILENT_ON_ROOM_UNAVAILABILITY",
      text: "The wording does not say what happens if the eligible room category was unavailable at admission. Some policies waive the deduction in that case; this wording is silent, so the calculation treats the chosen room as a choice.",
      affectedItemIds: included.map((i) => i.itemId),
      resolvableBy: "insurer",
      whatWouldResolveIt: "Ask the insurer in writing how it treats an upgrade forced by non-availability of the eligible room category.",
    });
  }

  const conditionInput = (): TraceInput[] =>
    needsCondition && condition.established !== null && condition.provenance !== null
      ? [{ name: "hospitalFollowsDifferentialBilling", value: { kind: "boolean", value: condition.established }, provenance: condition.provenance }]
      : [];
  const ratioInput = (): TraceInput[] => (keep ? [{ name: "ratio", value: { kind: "ratio", ratio: keep }, provenance: limitProvenance }] : []);

  if (condition.established === false) {
    const formula = `The hospital does not follow differential billing by room category, so ${rule.source.clauseId} does not apply; deduction = ${formatInr(ZERO)}`;
    return finish(
      { applicability: "conditionFailed", ratio: keep, trigger, trace: ruleTrace([...ratioInput(), ...conditionInput()], formula, "deduction.conditionFailed", { state: "calculated", value: ZERO }) },
      (item) => withResult(item, { state: "calculated", value: ZERO }, ruleTrace([...ratioInput(), ...conditionInput(), amountInput(item, args.estimateProvenance)], formula, "deduction.conditionFailed", { state: "calculated", value: ZERO })),
    );
  }

  // Per-item full deduction, or its two candidates when the ratio is ambiguous.
  const bounds = (item: ClassifiedItem): { low: Money; high: Money } => {
    const values = ratios.map((r) => mulRatio(item.amount, oneMinus(r)));
    return { low: values.reduce((a, b) => (b < a ? b : a)), high: values.reduce((a, b) => (b > a ? b : a)) };
  };
  const sumLow = sum(included.map((i) => bounds(i).low));
  const sumHigh = sum(included.map((i) => bounds(i).high));

  const reasons: UncertaintyReason[] = [];
  if (condition.established === null) {
    reasons.push({
      code: "DIFFERENTIAL_BILLING_NOT_ESTABLISHED",
      text: `The estimate does not state whether the hospital bills differently by room category. ${rule.source.clauseId} applies only where it does. Until this is established, the proportionate deduction is between ${formatInr(ZERO)} and ${formatInr(sumHigh)}.`,
      affectedItemIds: included.map((i) => i.itemId),
      amountAtStake: { low: ZERO, high: sumHigh, basis: `Not established whether the hospital follows differential billing by room category: low = no deduction (${rule.source.clauseId} does not apply), high = the full proportionate deduction` },
      resolvableBy: "hospital",
      whatWouldResolveIt: "Ask the hospital's billing desk whether the room category changes the rates of these items, then record the answer on Input review.",
    });
  }
  if (ambiguous) {
    reasons.push({
      code: "RATIO_AMBIGUOUS_ROOM_AND_ICU",
      text: `Both the room rate (${formatInr(args.ratePerDay)} against ${formatInr(eligibleRoom)} eligible) and the ICU rate (${formatInr(icuRate as Money)} against ${formatInr(eligibleIcu as Money)} eligible) exceed their limits, in different proportions. ${rule.source.clauseId} does not say which ratio applies, so the deduction is between ${formatInr(sumLow)} and ${formatInr(sumHigh)}.`,
      affectedItemIds: included.map((i) => i.itemId),
      amountAtStake: { low: sumLow, high: sumHigh, basis: "Room and ICU rates both exceed their limits in different proportions; low = the milder ratio, high = the stricter ratio" },
      resolvableBy: "insurer",
      whatWouldResolveIt: "Ask the insurer in writing which ratio it applies when both the room and the ICU rate exceed their limits.",
    });
  }
  const caveatReasons = new Map<string, UncertaintyReason>();
  for (const item of included) {
    for (const c of caveatsFor(args.ruleset, item)) {
      const existing = caveatReasons.get(c.code);
      const high = bounds(item).high;
      if (existing) {
        existing.affectedItemIds.push(item.itemId);
        existing.amountAtStake = { low: ZERO, high: sum([existing.amountAtStake!.high, high]), basis: existing.amountAtStake!.basis };
      } else {
        caveatReasons.set(c.code, {
          code: c.code,
          text: c.text,
          affectedItemIds: [item.itemId],
          amountAtStake: { low: ZERO, high, basis: "Requires insurer confirmation: low = the insurer does not apply the reduction to this item, high = it does" },
          resolvableBy: c.resolvableBy,
          whatWouldResolveIt: c.whatWouldResolveIt,
        });
      }
    }
  }
  uncertainties.push(...reasons, ...caveatReasons.values());

  const applicability = condition.established === null || ambiguous ? "conditional" : "applies";
  const totalOutput: TraceOutput =
    applicability === "applies" ? { state: "calculated", value: sumHigh } : { state: "conditional", value: null, range: { low: condition.established === null ? ZERO : sumLow, high: sumHigh, basis: reasons.map((r) => r.amountAtStake!.basis).join(" | ") } };
  const totalFormula =
    applicability === "applies"
      ? `total deduction = Σ item × (1 − ${keepText}) = ${formatInr(sumHigh)}`
      : `total deduction = Σ item × (1 − ${keepText}) = up to ${formatInr(sumHigh)}; ${reasons.map((r) => r.code).join(", ")} open`;
  const ruleResult: DeductionRuleResult = {
    applicability,
    ratio: keep,
    trigger,
    trace: ruleTrace(ratioInput(), totalFormula, "deduction.itemTimesOneMinusRatio", totalOutput, reasons),
  };

  return finish(ruleResult, (item) => {
    const b = bounds(item);
    const itemCaveats = caveatsFor(args.ruleset, item);
    const assumptions: UncertaintyReason[] = [...reasons, ...itemCaveats.map((c) => caveatReasons.get(c.code)!)];
    const inputs = [...ratioInput(), ...conditionInput(), amountInput(item, args.estimateProvenance)];
    if (assumptions.length === 0) {
      const formula = `deduction = ${formatInr(item.amount)} × (1 − ${keepText}) = ${formatInr(b.high, { paise: b.high % 100 !== 0 })}`;
      return withResult(item, { state: "calculated", value: b.high }, ruleTrace(inputs, formula, "deduction.itemTimesOneMinusRatio", { state: "calculated", value: b.high }));
    }
    const low = condition.established === null || itemCaveats.length > 0 ? ZERO : b.low;
    const basisParts: string[] = [];
    if (condition.established === null) basisParts.push("Not established whether the hospital follows differential billing by room category: low = no deduction, high = the full proportionate deduction");
    if (ambiguous) basisParts.push("Room and ICU rates both exceed their limits in different proportions: low = the milder ratio, high = the stricter ratio");
    if (itemCaveats.length > 0) basisParts.push("Requires insurer confirmation: low = the insurer does not apply the reduction to this item, high = it does");
    const range: Range = { low, high: b.high, basis: basisParts.join(" | ") };
    const formula = `deduction = ${formatInr(item.amount)} × (1 − ${keepText}) = up to ${formatInr(b.high, { paise: b.high % 100 !== 0 })}; between ${formatInr(low)} and ${formatInr(b.high, { paise: b.high % 100 !== 0 })} until ${assumptions.map((a) => a.code).join(", ")} resolved`;
    return withResult(item, { state: "conditional", value: null, range }, ruleTrace(inputs, formula, "deduction.itemTimesOneMinusRatio", { state: "conditional", value: null, range }, assumptions));
  });
}
