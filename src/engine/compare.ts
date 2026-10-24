import { type Money, sub } from "./money";
import type { BillCategory, Range, SimulationResult, TraceOutput } from "./types";

export interface MoneyDelta {
  a: Money;
  b: Money;
  delta: Money;
}

export interface NullableMoneyDelta {
  a: Money | null;
  b: Money | null;
  delta: Money | null;
}

export interface ComparisonRow {
  itemId: string;
  label: string;
  category: BillCategory;
  amount: Money;
  a: TraceOutput;
  b: TraceOutput;
  /** b − a when both sides are calculated or excluded; otherwise null. */
  delta: Money | null;
  changed: boolean;
  causeRuleIds: string[];
}

export interface Comparison {
  a: { scenarioId: string; label: string; roomLabel: string; ratePerDay: Money };
  b: { scenarioId: string; label: string; roomLabel: string; ratePerDay: Money };
  rows: ComparisonRow[];
  roomExcess: NullableMoneyDelta;
  icuExcess: NullableMoneyDelta;
  totals: {
    roomRent: MoneyDelta;
    scenarioTotal: MoneyDelta;
    calculatedDeductions: MoneyDelta;
    conditionalDeductions: { a: Range | null; b: Range | null };
    unclassifiedAmount: MoneyDelta;
  };
  changedRuleIds: string[];
}

function moneyDelta(a: Money, b: Money): MoneyDelta {
  return { a, b, delta: sub(b, a) };
}

function nullableDelta(a: Money | null, b: Money | null): NullableMoneyDelta {
  return { a, b, delta: a !== null && b !== null ? sub(b, a) : null };
}

function sameOutput(a: TraceOutput, b: TraceOutput): boolean {
  if (a.state !== b.state || a.value !== b.value) return false;
  if (!a.range && !b.range) return true;
  if (!a.range || !b.range) return false;
  return a.range.low === b.range.low && a.range.high === b.range.high;
}

function settled(o: TraceOutput): boolean {
  return (o.state === "calculated" || o.state === "excluded") && o.value !== null;
}

/** Side-by-side comparison of two evaluated scenarios on the same inputs, with the rule behind every change. */
export function compareScenarios(a: SimulationResult, b: SimulationResult): Comparison {
  const changedRuleIds = new Set<string>();
  const rows: ComparisonRow[] = a.items.map((ia) => {
    const ib = b.items.find((i) => i.itemId === ia.itemId);
    if (!ib) {
      throw new Error(`Scenario ${b.scenario.scenarioId} has no item "${ia.itemId}"; both scenarios must share one estimate`);
    }
    const changed = !sameOutput(ia.deduction, ib.deduction);
    const causeRuleIds = changed
      ? Array.from(new Set([ib.trace?.ruleId, ia.trace?.ruleId].filter((id): id is string => typeof id === "string")))
      : [];
    for (const id of causeRuleIds) changedRuleIds.add(id);
    return {
      itemId: ia.itemId,
      label: ia.label,
      category: ia.category,
      amount: ia.amount,
      a: ia.deduction,
      b: ib.deduction,
      delta: settled(ia.deduction) && settled(ib.deduction) ? sub(ib.deduction.value as Money, ia.deduction.value as Money) : null,
      changed,
      causeRuleIds,
    };
  });

  const roomExcess = nullableDelta(a.roomExcess.value, b.roomExcess.value);
  if (a.roomExcess.value !== b.roomExcess.value || a.roomExcess.state !== b.roomExcess.state) {
    for (const id of [a.roomExcess.trace?.ruleId, b.roomExcess.trace?.ruleId]) if (id) changedRuleIds.add(id);
  }
  const icuExcess = nullableDelta(a.icuExcess.value, b.icuExcess.value);
  if (a.icuExcess.value !== b.icuExcess.value || a.icuExcess.state !== b.icuExcess.state) {
    for (const id of [a.icuExcess.trace?.ruleId, b.icuExcess.trace?.ruleId]) if (id) changedRuleIds.add(id);
  }
  if (a.deductionRule.applicability !== b.deductionRule.applicability) {
    for (const id of [a.deductionRule.trace?.ruleId, b.deductionRule.trace?.ruleId]) if (id) changedRuleIds.add(id);
  }

  return {
    a: { scenarioId: a.scenario.scenarioId, label: a.scenario.label, roomLabel: a.scenario.roomLabel, ratePerDay: a.scenario.ratePerDay },
    b: { scenarioId: b.scenario.scenarioId, label: b.scenario.label, roomLabel: b.scenario.roomLabel, ratePerDay: b.scenario.ratePerDay },
    rows,
    roomExcess,
    icuExcess,
    totals: {
      roomRent: moneyDelta(a.totals.roomRent, b.totals.roomRent),
      scenarioTotal: moneyDelta(a.totals.scenarioTotal, b.totals.scenarioTotal),
      calculatedDeductions: moneyDelta(a.totals.calculatedDeductions, b.totals.calculatedDeductions),
      conditionalDeductions: { a: a.totals.conditionalDeductions, b: b.totals.conditionalDeductions },
      unclassifiedAmount: moneyDelta(a.totals.unclassifiedAmount, b.totals.unclassifiedAmount),
    },
    changedRuleIds: Array.from(changedRuleIds),
  };
}
