"use client";

import type { Comparison } from "@/engine/compare";
import type { SimulationResult, Trace } from "@/engine/types";
import { OutputAmount } from "../amounts";
import { StateBadge } from "../badges";
import { inputLabel, money, rangeText, signedMoney, traceValue } from "../format";

interface Props {
  a: SimulationResult;
  b: SimulationResult;
  cmp: Comparison;
  onOpenTrace: (title: string, trace: Trace) => void;
  onOpenTwin: () => void;
}

interface RuleCard {
  ruleId: string;
  traceA: Trace | null;
  traceB: Trace | null;
  rows: { label: string; a: Parameters<typeof OutputAmount>[0]["output"]; b: Parameters<typeof OutputAmount>[0]["output"]; delta: string; traceB: Trace | null }[];
}

function buildCards(a: SimulationResult, b: SimulationResult, cmp: Comparison): RuleCard[] {
  const cards: RuleCard[] = [];
  for (const ruleId of cmp.changedRuleIds) {
    const rows: RuleCard["rows"] = [];
    let traceA: Trace | null = null;
    let traceB: Trace | null = null;
    if (a.roomExcess.trace?.ruleId === ruleId || b.roomExcess.trace?.ruleId === ruleId) {
      traceA = a.roomExcess.trace;
      traceB = b.roomExcess.trace;
      rows.push({
        label: `Room rent above the limit, ${b.scenario.roomDays} days`,
        a: { state: a.roomExcess.state, value: a.roomExcess.value },
        b: { state: b.roomExcess.state, value: b.roomExcess.value },
        delta: cmp.roomExcess.delta !== null ? signedMoney(cmp.roomExcess.delta) : "—",
        traceB: b.roomExcess.trace,
      });
    }
    if (a.icuExcess.trace?.ruleId === ruleId || b.icuExcess.trace?.ruleId === ruleId) {
      traceA = traceA ?? a.icuExcess.trace;
      traceB = traceB ?? b.icuExcess.trace;
      rows.push({
        label: "ICU charges above the limit",
        a: { state: a.icuExcess.state, value: a.icuExcess.value },
        b: { state: b.icuExcess.state, value: b.icuExcess.value },
        delta: cmp.icuExcess.delta !== null ? signedMoney(cmp.icuExcess.delta) : "—",
        traceB: b.icuExcess.trace,
      });
    }
    for (const row of cmp.rows) {
      if (!row.changed || !row.causeRuleIds.includes(ruleId)) continue;
      const ib = b.items.find((i) => i.itemId === row.itemId);
      const ia = a.items.find((i) => i.itemId === row.itemId);
      traceB = traceB ?? ib?.trace ?? null;
      traceA = traceA ?? ia?.trace ?? null;
      const high = row.b.range ? ` (up to ${money(row.b.range.high)})` : "";
      rows.push({ label: row.label, a: row.a, b: row.b, delta: row.delta !== null ? signedMoney(row.delta) : row.b.range ? `conditional${high}` : "—", traceB: ib?.trace ?? null });
    }
    if (!traceB && b.deductionRule.trace?.ruleId === ruleId) traceB = b.deductionRule.trace;
    if (!traceA && a.deductionRule.trace?.ruleId === ruleId) traceA = a.deductionRule.trace;
    cards.push({ ruleId, traceA, traceB, rows });
  }
  return cards;
}

function differingInputs(traceA: Trace | null, traceB: Trace | null) {
  if (!traceB) return [];
  const byName = new Map(traceA?.inputs.map((i) => [i.name, i]) ?? []);
  return traceB.inputs
    .filter((i) => i.name !== "itemAmount")
    .map((i) => ({ name: i.name, a: byName.get(i.name) ? traceValue(byName.get(i.name)!.value) : "—", b: traceValue(i.value) }))
    .filter((i) => i.a !== i.b);
}

export function WhyThisChangedScreen({ a, b, cmp, onOpenTrace, onOpenTwin }: Props) {
  const cards = buildCards(a, b, cmp);
  const cond = cmp.totals.conditionalDeductions;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-stone-500">Why this changed</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
          From {a.scenario.roomLabel.toLowerCase()} to {b.scenario.roomLabel.toLowerCase()}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
          {money(a.scenario.ratePerDay)} per day against {money(b.scenario.ratePerDay)} per day, on the same policy and the same estimate. Each change below names the clause that caused it.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Room rent" value={signedMoney(cmp.totals.roomRent.delta)} />
        <Stat label="Scenario total" value={signedMoney(cmp.totals.scenarioTotal.delta)} />
        <Stat label="Calculated deductions" value={signedMoney(cmp.totals.calculatedDeductions.delta)} strong />
        <Stat label="Conditional deductions" value={`${cond.a ? rangeText(cond.a) : "None"} → ${cond.b ? rangeText(cond.b) : "None"}`} />
      </dl>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-700 shadow-sm">
          Both rooms give the same result under this wording&apos;s rules. Nothing changed, so there is nothing to explain.{" "}
          <button type="button" onClick={onOpenTwin} className="font-medium text-stone-900 underline underline-offset-2">
            Pick a different room on the Twin.
          </button>
        </div>
      ) : (
        cards.map((card) => {
          const trace = card.traceB ?? card.traceA;
          const diffs = differingInputs(card.traceA, card.traceB);
          return (
            <section key={card.ruleId} className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <header className="border-b border-stone-200 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Rule</p>
                <h2 className="mt-1 text-lg font-semibold text-stone-900">
                  {trace?.ruleName ?? card.ruleId} <span className="font-mono text-xs font-normal text-stone-400">{card.ruleId}</span>
                </h2>
              </header>
              <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Source clause</h3>
                  {trace ? (
                    <>
                      <blockquote className="mt-2 rounded-lg border-l-4 border-stone-900 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800">“{trace.source.quotedText}”</blockquote>
                      <p className="mt-2 text-xs text-stone-500">
                        Clause {trace.source.clauseId}, page {trace.source.page}. {trace.source.documentTitle}.
                      </p>
                    </>
                  ) : null}
                  {diffs.length > 0 ? (
                    <>
                      <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-stone-500">What differs between A and B</h3>
                      <table className="mt-2 w-full text-sm">
                        <thead>
                          <tr className="text-xs text-stone-500">
                            <th className="py-1 text-left font-normal">Input</th>
                            <th className="py-1 text-right font-normal">A</th>
                            <th className="py-1 text-right font-normal">B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffs.map((d) => (
                            <tr key={d.name} className="border-t border-stone-100">
                              <th scope="row" className="py-1.5 text-left font-normal text-stone-600">{inputLabel(d.name)}</th>
                              <td className="py-1.5 text-right tabular-nums text-stone-700">{d.a}</td>
                              <td className="py-1.5 text-right tabular-nums font-medium text-stone-900">{d.b}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                  {card.traceA ? (
                    <p className="mt-4 font-mono text-[12px] leading-5 text-stone-500">
                      A: {card.traceA.formula}
                    </p>
                  ) : null}
                  {card.traceB ? (
                    <p className="mt-1 font-mono text-[12px] leading-5 text-stone-800">
                      B: {card.traceB.formula}
                    </p>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Affected rows</h3>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-xs text-stone-500">
                        <th className="py-1 text-left font-normal">Item</th>
                        <th className="py-1 text-right font-normal">A</th>
                        <th className="py-1 text-right font-normal">B</th>
                        <th className="py-1 text-right font-normal">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.rows.map((row) => (
                        <tr key={row.label} className="border-t border-stone-100">
                          <th scope="row" className="py-2 text-left font-normal text-stone-800">{row.label}</th>
                          <td className="py-2 text-right">
                            <span className="tabular-nums text-stone-700"><OutputAmount output={row.a} /></span>
                            <StateBadge state={row.a.state} className="ml-1.5" />
                          </td>
                          <td className="py-2 text-right">
                            {row.traceB ? (
                              <button type="button" onClick={() => onOpenTrace(`${row.label}, ${b.scenario.roomLabel}`, row.traceB!)} className="rounded px-1 font-medium tabular-nums text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">
                                <OutputAmount output={row.b} />
                              </button>
                            ) : (
                              <span className="tabular-nums"><OutputAmount output={row.b} /></span>
                            )}
                            <StateBadge state={row.b.state} className="ml-1.5" />
                          </td>
                          <td className="py-2 text-right tabular-nums text-stone-700">{row.delta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {trace?.assumptions.length ? (
                    <ul className="mt-4 flex flex-col gap-2">
                      {trace.assumptions.map((u) => (
                        <li key={u.code} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{u.text}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? "text-xl font-semibold text-stone-900" : "text-base font-medium text-stone-800"}`}>{value}</dd>
    </div>
  );
}
