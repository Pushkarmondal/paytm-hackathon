"use client";

import type { Ladder } from "@/model/ladder";
import { Amount, RangeAmount } from "./amounts";
import { money } from "./format";

interface Props {
  ladder: Ladder;
  plannedRoomId: string;
  onPlanRoom: (roomId: string) => void;
}

export function RoomLadder({ ladder, plannedRoomId, onPlanRoom }: Props) {
  const max = Math.max(1, ...ladder.rows.map((r) => (r.conditional ? r.calculated + r.conditional.high : r.calculated)));
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500">All rooms at a glance</h2>
        <p className="text-xs text-stone-500">
          {ladder.eligiblePerDay !== null ? `Room-rent limit ${money(ladder.eligiblePerDay)} per day` : "Room-rent limit cannot be determined"}
        </p>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-stone-500">
            <th scope="col" className="py-2 text-left font-medium">Room</th>
            <th scope="col" className="py-2 text-right font-medium">Rate / day</th>
            <th scope="col" className="py-2 text-left font-medium pl-4">Potential deductions covered</th>
            <th scope="col" className="py-2 text-right font-medium">Scenario total</th>
            <th scope="col" className="py-2 text-right font-medium"><span className="sr-only">Plan</span></th>
          </tr>
        </thead>
        <tbody>
          {ladder.rows.map((r) => {
            const best = r.roomId === ladder.bestWithinLimitRoomId;
            const planned = r.roomId === plannedRoomId;
            const calcW = (r.calculated / max) * 100;
            const condW = r.conditional ? (r.conditional.high / max) * 100 : 0;
            return (
              <tr key={r.roomId} className={`border-t border-stone-100 ${planned ? "bg-stone-50" : ""}`}>
                <th scope="row" className="py-2.5 text-left font-normal">
                  <span className="font-medium text-stone-900">{r.label}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {r.withinRoomLimit === true ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">within the limit</span> : null}
                    {r.withinRoomLimit === false ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">above the limit by {money((r.ratePerDay - (ladder.eligiblePerDay ?? 0)))}/day</span> : null}
                    {best ? <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-medium text-white">highest room within the limit</span> : null}
                    {planned ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-300">planned</span> : null}
                  </span>
                </th>
                <td className="py-2.5 text-right tabular-nums text-stone-700">{money(r.ratePerDay)}</td>
                <td className="py-2.5 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                      <div className="flex h-full">
                        <div className="h-full bg-stone-900" style={{ width: `${calcW}%` }} />
                        <div className="h-full bg-amber-300" style={{ width: `${condW}%` }} />
                      </div>
                    </div>
                    <span className="text-xs tabular-nums text-stone-800">
                      <Amount paise={r.calculated} /> calculated
                      {r.conditional ? (
                        <>
                          , <RangeAmount range={r.conditional} /> conditional
                        </>
                      ) : null}
                      {r.unclassified > 0 ? <span className="text-stone-500">, {money(r.unclassified)} not classified</span> : null}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums text-stone-900"><Amount paise={r.scenarioTotal} /></td>
                <td className="py-2.5 text-right">
                  {planned ? null : (
                    <button type="button" onClick={() => onPlanRoom(r.roomId)} className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-800 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">
                      Plan this room
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-stone-500">Dark bar: calculated deductions. Amber: the top of the conditional range. Not classified items are never in a bar.</p>
    </section>
  );
}
