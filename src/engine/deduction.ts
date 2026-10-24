import { formatInr } from "@/lib/format-inr";
import type { ResolvedLimit } from "./limits";
import { type Money, type Ratio, ZERO, mulRatio, oneMinus, ratio, sum } from "./money";
import type {
  ClassifiedItem,
  Confirmations,
  DeductionRuleResult,
  DifferentialBillingStatement,
  ItemResult,
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

function conditionStatus(
  statement: DifferentialBillingStatement,
  estimateProvenance: Provenance,
  confirmations: Confirmations,
): ConditionStatus {
  const confirmed = confirmations.hospitalFollowsDifferentialBilling;
  if (confirmed !== undefined) {
    return { established: confirmed, provenance: "userConfirmed" };
  }
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
  const source: SourceRef | null =
    item.classificationSource ??
    args.ruleset.rules.proportionateDeduction?.source ??
    args.ruleset.rules.itemClasses?.source ??
    null;
  if (!source) {
    return unknownItem(item);
  }
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
        : `${item.label}: not an Associated Medical Expense under ${source.clauseId}; deduction = ${formatInr(ZERO)}`,
    operation: byUser ? "deduction.excludedByUser" : "deduction.excludedByDefinition",
    output: { state: "excluded", value: ZERO },
    assumptions: [],
  };
  return withResult(item, { state: "excluded", value: ZERO }, trace);
}

function unclassifiedReason(items: ClassifiedItem[]): UncertaintyReason | null {
  const unknown = items.filter((i) => i.classification === "unknown");
  if (unknown.length === 0) return null;
  const list = unknown.map((i) => `${i.label} (${formatInr(i.amount)})`).join(" and ");
  return {
    code: "ITEM_NOT_CLASSIFIED",
    text: `The wording does not say whether ${list} count as Associated Medical Expenses, and does not exclude them either. They are shown separately and are not part of any total.`,
    affectedItemIds: unknown.map((i) => i.itemId),
    resolvableBy: "user",
    whatWouldResolveIt:
      "Classify the item on Input review (recorded as your own assumption), or ask the insurer how it treats this charge.",
  };
}

/** Applies the policy's proportionate-deduction rule to the classified items, or explains why it cannot. */
export function evaluateDeduction(args: DeductionArgs): DeductionEvaluation {
  const rulesetProvenance = args.rulesetProvenance ?? "fixture";
  const rule = args.ruleset.rules.proportionateDeduction;
  const included = args.items.filter((i) => i.classification === "includedInDeduction");
  const uncertainties: UncertaintyReason[] = [];
  const unclassified = unclassifiedReason(args.items);
  if (unclassified) uncertainties.push(unclassified);

  const finish = (
    ruleResult: DeductionRuleResult,
    includedResult: (item: ClassifiedItem) => ItemResult,
    conditionalTotal: Range | null,
  ): DeductionEvaluation => ({
    rule: ruleResult,
    items: args.items.map((item) => {
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
    }),
    uncertainties,
    conditionalTotal,
  });

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
    const ruleTrace = makeTrace([
      { name: "wording", value: { kind: "text", text: `${args.ruleset.metadata.name}, wording v${args.ruleset.metadata.wordingVersion}` }, provenance: rulesetProvenance },
    ]);
    return finish(
      { applicability: "ruleAbsent", ratio: null, trace: ruleTrace },
      (item) => {
        const trace = makeTrace([amountInput(item, args.estimateProvenance)]);
        return trace ? withResult(item, { state: "calculated", value: ZERO }, trace) : unknownItem(item);
      },
      null,
    );
  }

  const eligible = args.roomLimit.eligiblePerDay;
  if (args.roomLimit.state !== "calculated" || eligible === null) {
    return finish({ applicability: "undetermined", ratio: null, trace: null }, unknownItem, null);
  }

  const limitProvenance = args.roomLimit.trace?.inputs[0]?.provenance ?? rulesetProvenance;
  const baseInputs = (): TraceInput[] => [
    { name: "ratePerDay", value: { kind: "money", paise: args.ratePerDay }, provenance: args.rateProvenance },
    { name: "eligiblePerDay", value: { kind: "money", paise: eligible }, provenance: limitProvenance },
  ];

  if (args.ratePerDay <= eligible) {
    const formula = `${formatInr(args.ratePerDay)} per day is within the eligible ${formatInr(eligible)} per day: no proportionate deduction under ${rule.source.clauseId}; deduction = ${formatInr(ZERO)}`;
    const makeTrace = (extra: TraceInput[]): Trace => ({
      ruleId: rule.ruleId,
      ruleName: "Proportionate deduction",
      inputs: [...baseInputs(), ...extra],
      source: rule.source,
      formula,
      operation: "deduction.withinEntitlement",
      output: { state: "calculated", value: ZERO },
      assumptions: [],
    });
    return finish(
      { applicability: "withinEntitlement", ratio: null, trace: makeTrace([]) },
      (item) => withResult(item, { state: "calculated", value: ZERO }, makeTrace([amountInput(item, args.estimateProvenance)])),
      null,
    );
  }

  const keep: Ratio = ratio(eligible, args.ratePerDay);
  const cut = oneMinus(keep);
  const ratioText = `${formatInr(eligible)} ÷ ${formatInr(args.ratePerDay)}`.replace(/₹/g, "");
  const condition = conditionStatus(args.differentialBilling, args.estimateProvenance, args.confirmations);
  const fullOf = (item: ClassifiedItem): Money => mulRatio(item.amount, cut);
  const fullTotal = sum(included.map(fullOf));

  if (!args.ruleset.rules.roomUnavailabilityClause) {
    uncertainties.push({
      code: "WORDING_SILENT_ON_ROOM_UNAVAILABILITY",
      text: "The wording does not say what happens if the eligible room category was unavailable at admission. Some policies waive the deduction in that case; this wording is silent, so the calculation treats the chosen room as a choice.",
      affectedItemIds: included.map((i) => i.itemId),
      resolvableBy: "insurer",
      whatWouldResolveIt: "Ask the insurer in writing how it treats an upgrade forced by non-availability of the eligible room category.",
    });
  }

  const conditionInput = (): TraceInput[] =>
    condition.established === null || condition.provenance === null
      ? []
      : [{ name: "hospitalFollowsDifferentialBilling", value: { kind: "boolean", value: condition.established }, provenance: condition.provenance }];
  const ratioInput: TraceInput = { name: "ratio", value: { kind: "ratio", ratio: keep }, provenance: limitProvenance };

  if (condition.established === false) {
    const formula = `The hospital does not follow differential billing by room category, so ${rule.source.clauseId} does not apply; deduction = ${formatInr(ZERO)}`;
    const makeTrace = (extra: TraceInput[]): Trace => ({
      ruleId: rule.ruleId,
      ruleName: "Proportionate deduction",
      inputs: [...baseInputs(), ratioInput, ...conditionInput(), ...extra],
      source: rule.source,
      formula,
      operation: "deduction.conditionFailed",
      output: { state: "calculated", value: ZERO },
      assumptions: [],
    });
    return finish(
      { applicability: "conditionFailed", ratio: keep, trace: makeTrace([]) },
      (item) => withResult(item, { state: "calculated", value: ZERO }, makeTrace([amountInput(item, args.estimateProvenance)])),
      null,
    );
  }

  if (condition.established === true) {
    const makeTrace = (extra: TraceInput[], formula: string, value: Money): Trace => ({
      ruleId: rule.ruleId,
      ruleName: "Proportionate deduction",
      inputs: [...baseInputs(), ratioInput, ...conditionInput(), ...extra],
      source: rule.source,
      formula,
      operation: "deduction.itemTimesOneMinusRatio",
      output: { state: "calculated", value },
      assumptions: [],
    });
    return finish(
      {
        applicability: "applies",
        ratio: keep,
        trace: makeTrace([], `total deduction = Σ item × (1 − ${ratioText}) = ${formatInr(fullTotal)}`, fullTotal),
      },
      (item) => {
        const full = fullOf(item);
        return withResult(
          item,
          { state: "calculated", value: full },
          makeTrace([amountInput(item, args.estimateProvenance)], `deduction = ${formatInr(item.amount)} × (1 − ${ratioText}) = ${formatInr(full, { paise: full % 100 !== 0 })}`, full),
        );
      },
      null,
    );
  }

  const basis = `Not established whether the hospital follows differential billing by room category: low = no deduction (${rule.source.clauseId} does not apply), high = the full proportionate deduction`;
  const reason: UncertaintyReason = {
    code: "DIFFERENTIAL_BILLING_NOT_ESTABLISHED",
    text: `The estimate does not state whether the hospital bills differently by room category. ${rule.source.clauseId} applies only where it does. Until this is established, the proportionate deduction is between ${formatInr(ZERO)} and ${formatInr(fullTotal)}.`,
    affectedItemIds: included.map((i) => i.itemId),
    amountAtStake: { low: ZERO, high: fullTotal, basis },
    resolvableBy: "hospital",
    whatWouldResolveIt:
      "Ask the hospital's billing desk whether the room category changes the rates of these items, then record the answer on Input review.",
  };
  uncertainties.push(reason);
  const makeTrace = (extra: TraceInput[], formula: string, high: Money): Trace => ({
    ruleId: rule.ruleId,
    ruleName: "Proportionate deduction",
    inputs: [...baseInputs(), ratioInput, ...extra],
    source: rule.source,
    formula,
    operation: "deduction.itemTimesOneMinusRatio",
    output: { state: "conditional", value: null, range: { low: ZERO, high, basis } },
    assumptions: [reason],
  });
  const conditionalTotal: Range = { low: ZERO, high: fullTotal, basis };
  return finish(
    {
      applicability: "conditional",
      ratio: keep,
      trace: makeTrace([], `total deduction = Σ item × (1 − ${ratioText}) = ${formatInr(fullTotal)} if the hospital follows differential billing; otherwise ${formatInr(ZERO)}`, fullTotal),
    },
    (item) => {
      const full = fullOf(item);
      return withResult(
        item,
        { state: "conditional", value: null, range: { low: ZERO, high: full, basis } },
        makeTrace(
          [amountInput(item, args.estimateProvenance)],
          `deduction = ${formatInr(item.amount)} × (1 − ${ratioText}) = ${formatInr(full, { paise: full % 100 !== 0 })} if the hospital follows differential billing; otherwise ${formatInr(ZERO)}`,
          full,
        ),
      );
    },
    conditionalTotal,
  );
}
