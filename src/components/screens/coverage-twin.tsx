"use client";

import type { Comparison, ComparisonRow } from "@/engine/compare";
import type { Money } from "@/engine/money";
import type { CaseInputs, ItemResult, SimulationResult, Trace, TraceOutput } from "@/engine/types";
import { type RoomChoice, type Side, headlineFor } from "@/model";
import { Amount, OutputAmount, RangeAmount } from "../amounts";
import { StateBadge } from "../badges";
import { money, signedMoney } from "../format";
import { RoomPicker } from "../room-picker";

interface Props {
  inputs: CaseInputs;
  a: SimulationResult;
  b: SimulationResult;
  cmp: Comparison;
  choices: { comparison: RoomChoice; planned: RoomChoice };
  onSelectRoom: (side: Side, roomId: string) => void;
  onSetRate: (side: Side, rate: Money) => void;
  onOpenTrace: (title: string, trace: Trace) => void;
  onOpenWhy: () => void;
}

function changeText(row: ComparisonRow): string {
  if (row.delta !== null) return signedMoney(row.delta);
  const ah = row.a.range?.high ?? (row.a.state === "calculated" ? row.a.value : null);
  const bh = row.b.range?.high ?? (row.b.state === "calculated" ? row.b.value : null);
  if (ah !== null && bh !== null && ah !== undefined && bh !== undefined) {
    const d = bh - ah;
    return d === 0 ? "No change" : `up to ${signedMoney(d)}`;
  }
  return "—";
}

function OutputCell({ output, trace, title, onOpenTrace }: { output: TraceOutput; trace: Trace | null; title: string; onOpenTrace: Props["onOpenTrace"] }) {
  const body = (
    <>
      <span className="text-base font-medium text-stone-900">
        <OutputAmount output={output} />
      </span>
      <StateBadge state={output.state} />
    </>
  );
  if (!trace) {
    return <div className="flex flex-col items-end gap-1 px-2 py-1 text-right">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpenTrace(title, trace)}
      className="group flex w-full flex-col items-end gap-1 rounded-md px-2 py-1 text-right hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      aria-label={`${title}: ${output.state}. Open the calculation.`}
    >
      {body}
    </button>
  );
}

function GroupHeader({ label, note }: { label: string; note?: string }) {
  return (
    <tr>
      <th colSpan={5} scope="colgroup" className="bg-stone-50 px-3 pb-1.5 pt-4 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">
        {label}
        {note ? <span className="ml-2 normal-case tracking-normal text-stone-400">{note}</span> : null}
      </th>
    </tr>
  );
}

export function CoverageTwinScreen({ inputs, a, b, cmp, choices, onSelectRoom, onSetRate, onOpenTrace, onOpenWhy }: Props) {
  const rowsById = new Map(cmp.rows.map((r) => [r.itemId, r]));
  const itemsA = new Map(a.items.map((i) => [i.itemId, i]));
  const itemsB = new Map(b.items.map((i) => [i.itemId, i]));
  const groups: { label: string; note?: string; ids: string[] }[] = [
    { label: "Associated medical expenses", note: inputs.ruleset.rules.itemClasses ? `as defined by ${inputs.ruleset.rules.itemClasses.source.clauseId}` : undefined, ids: b.items.filter((i) => i.classification === "includedInDeduction").map((i) => i.itemId) },
    { label: "Not subject to the proportionate deduction", ids: b.items.filter((i) => i.classification === "excludedFromDeduction").map((i) => i.itemId) },
    { label: "Not classified by the wording", ids: b.items.filter((i) => i.classification === "unknown").map((i) => i.itemId) },
  ];
  const icuIds = b.items.filter((i) => i.classification === "icu").map((i) => i.itemId);
  const flashKey = `${a.scenario.roomId}:${a.scenario.ratePerDay}|${b.scenario.roomId}:${b.scenario.ratePerDay}|${inputs.confirmations.hospitalFollowsDifferentialBilling ?? "n"}`;
  const roomChanged = cmp.roomExcess.a !== cmp.roomExcess.b;
  const headA = headlineFor(a);
  const headB = headlineFor(b);
  const rowClass = (changed: boolean) => (changed ? "row-flash bg-amber-50/50" : "");

  const itemRow = (id: string) => {
    const row = rowsById.get(id);
    const ia = itemsA.get(id) as ItemResult;
    const ib = itemsB.get(id) as ItemResult;
    if (!row) return null;
    return (
      <tr key={id} className={`border-t border-stone-100 ${rowClass(row.changed)}`}>
        <th scope="row" className="px-3 py-2 text-left font-normal">
          <span className="text-stone-900">{row.label}</span>
        </th>
        <td className="px-3 py-2 text-right tabular-nums text-stone-700">{money(row.amount)}</td>
        <td className="px-1 py-1">
          <OutputCell output={ia.deduction} trace={ia.trace} title={`${row.label}, ${a.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
        </td>
        <td className="px-1 py-1">
          <OutputCell output={ib.deduction} trace={ib.trace} title={`${row.label}, ${b.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
        </td>
        <td className={`whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums ${row.changed ? "font-medium text-stone-900" : "text-stone-400"}`}>{changeText(row)}</td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">Coverage Twin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Change your room. See the difference.</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
            The same policy and the same estimate, two room choices side by side. Every amount is clickable and opens the clause, the inputs and the formula behind it.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenWhy}
          className="inline-flex h-10 items-center self-start rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          Why this changed
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <RoomPicker label="A · Comparison room" options={inputs.estimate.roomOptions} choice={choices.comparison} onSelectRoom={(id) => onSelectRoom("comparison", id)} onSetRate={(r) => onSetRate("comparison", r)} accent="a" />
        </div>
        <div className="rounded-xl border border-stone-900 bg-white p-4 shadow-sm">
          <RoomPicker label="B · Planned room" options={inputs.estimate.roomOptions} choice={choices.planned} onSelectRoom={(id) => onSelectRoom("planned", id)} onSetRate={(r) => onSetRate("planned", r)} accent="b" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Item</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Amount</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                A · {a.scenario.roomLabel}
                <span className="block font-normal normal-case tracking-normal text-stone-400">{money(a.scenario.ratePerDay)} per day</span>
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-900">
                B · {b.scenario.roomLabel}
                <span className="block font-normal normal-case tracking-normal text-stone-500">{money(b.scenario.ratePerDay)} per day</span>
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Change</th>
            </tr>
          </thead>
          <tbody key={flashKey}>
            <GroupHeader label="Room and ICU" note="governed by the daily limits" />
            <tr className={`border-t border-stone-100 ${rowClass(roomChanged)}`}>
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="text-stone-900">Room rent, {b.scenario.roomDays} days</span>
                <span className="block text-xs text-stone-500">
                  A {money(a.totals.roomRent)} · B {money(b.totals.roomRent)}
                </span>
              </th>
              <td className="px-3 py-2 text-right text-xs text-stone-500">per scenario</td>
              <td className="px-1 py-1">
                <OutputCell output={{ state: a.roomExcess.state, value: a.roomExcess.value }} trace={a.roomExcess.trace} title={`Room rent above the limit, ${a.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
              </td>
              <td className="px-1 py-1">
                <OutputCell output={{ state: b.roomExcess.state, value: b.roomExcess.value }} trace={b.roomExcess.trace} title={`Room rent above the limit, ${b.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
              </td>
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${roomChanged ? "font-medium text-stone-900" : "text-stone-400"}`}>
                {cmp.roomExcess.delta !== null ? signedMoney(cmp.roomExcess.delta) : "—"}
              </td>
            </tr>
            {icuIds.map((id) => {
              const row = rowsById.get(id)!;
              return (
                <tr key={id} className="border-t border-stone-100">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="text-stone-900">{row.label}</span>
                    <span className="block text-xs text-stone-500">ICU limit applies; never part of the proportionate deduction</span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">{money(row.amount)}</td>
                  <td className="px-1 py-1">
                    <OutputCell output={{ state: a.icuExcess.state, value: a.icuExcess.value }} trace={a.icuExcess.trace} title={`ICU charges above the limit, ${a.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
                  </td>
                  <td className="px-1 py-1">
                    <OutputCell output={{ state: b.icuExcess.state, value: b.icuExcess.value }} trace={b.icuExcess.trace} title={`ICU charges above the limit, ${b.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-400">{cmp.icuExcess.delta !== null ? signedMoney(cmp.icuExcess.delta) : "—"}</td>
                </tr>
              );
            })}
            {groups.map((g) =>
              g.ids.length === 0 ? null : (
                <GroupHeaderAndRows key={g.label} label={g.label} note={g.note}>
                  {g.ids.map(itemRow)}
                </GroupHeaderAndRows>
              ),
            )}
          </tbody>
          <tfoot className="border-t-2 border-stone-200 bg-stone-50 text-sm">
            <FootRow label="Room rent" a={<Amount paise={a.totals.roomRent} />} b={<Amount paise={b.totals.roomRent} />} delta={signedMoney(cmp.totals.roomRent.delta)} />
            <FootRow label="Scenario total" note="non-room items plus room rent" a={<Amount paise={a.totals.scenarioTotal} />} b={<Amount paise={b.totals.scenarioTotal} />} delta={signedMoney(cmp.totals.scenarioTotal.delta)} />
            {a.copay.state !== "excluded" || b.copay.state !== "excluded" ? (
              <tr className="border-t border-stone-200">
                <th scope="row" colSpan={2} className="px-3 py-2 text-left font-normal text-stone-700">
                  Co-payment
                  <span className="ml-2 text-xs text-stone-400">on the admissible amount</span>
                </th>
                <td className="px-1 py-1">
                  <OutputCell output={{ state: a.copay.state, value: a.copay.value, range: a.copay.range }} trace={a.copay.trace} title={`Co-payment, ${a.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
                </td>
                <td className="px-1 py-1">
                  <OutputCell output={{ state: b.copay.state, value: b.copay.value, range: b.copay.range }} trace={b.copay.trace} title={`Co-payment, ${b.scenario.roomLabel}`} onOpenTrace={onOpenTrace} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-400">
                  {a.copay.value !== null && b.copay.value !== null ? signedMoney(b.copay.value - a.copay.value) : "—"}
                </td>
              </tr>
            ) : null}
            <FootRow label="Calculated deductions" a={<Amount paise={a.totals.calculatedDeductions} />} b={<Amount paise={b.totals.calculatedDeductions} />} delta={signedMoney(cmp.totals.calculatedDeductions.delta)} strong />
            <FootRow
              label="Conditional deductions"
              a={a.totals.conditionalDeductions ? <RangeAmount range={a.totals.conditionalDeductions} /> : <span className="text-stone-400">None</span>}
              b={b.totals.conditionalDeductions ? <RangeAmount range={b.totals.conditionalDeductions} /> : <span className="text-stone-400">None</span>}
              delta=""
            />
            <FootRow label="Not classified" note="shown separately, never totalled" a={<Amount paise={a.totals.unclassifiedAmount} />} b={<Amount paise={b.totals.unclassifiedAmount} />} delta="" />
            <tr className="border-t border-stone-200">
              <th scope="row" colSpan={2} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Potential deductions covered by this simulation
              </th>
              <td className="px-3 py-3 text-right text-xs leading-5 text-stone-700">{headA.summary}</td>
              <td className="px-3 py-3 text-right text-xs font-medium leading-5 text-stone-900">{headB.summary}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GroupHeaderAndRows({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <>
      <GroupHeader label={label} note={note} />
      {children}
    </>
  );
}

function FootRow({ label, note, a, b, delta, strong = false }: { label: string; note?: string; a: React.ReactNode; b: React.ReactNode; delta: string; strong?: boolean }) {
  return (
    <tr className="border-t border-stone-200">
      <th scope="row" colSpan={2} className="px-3 py-2 text-left font-normal text-stone-700">
        {label}
        {note ? <span className="ml-2 text-xs text-stone-400">{note}</span> : null}
      </th>
      <td className={`px-3 py-2 text-right ${strong ? "font-medium text-stone-900" : "text-stone-700"}`}>{a}</td>
      <td className={`px-3 py-2 text-right ${strong ? "font-semibold text-stone-900" : "text-stone-900"}`}>{b}</td>
      <td className="px-3 py-2 text-right tabular-nums text-stone-600">{delta}</td>
    </tr>
  );
}
