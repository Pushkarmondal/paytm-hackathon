"use client";

import { useId } from "react";
import { rupees } from "@/engine/money";
import type { RoomOption } from "@/engine/types";
import type { RoomChoice } from "@/model";
import { ProvenanceBadge } from "./badges";

interface Props {
  label: string;
  options: readonly RoomOption[];
  choice: RoomChoice;
  onSelectRoom: (roomId: string) => void;
  onSetRate: (ratePerDay: ReturnType<typeof rupees>) => void;
  accent?: "a" | "b";
}

export function RoomPicker({ label, options, choice, onSelectRoom, onSetRate, accent = "b" }: Props) {
  const selectId = useId();
  const rateId = useId();
  const option = options.find((o) => o.roomId === choice.roomId) ?? options[0];
  const rate = choice.ratePerDay ?? option.ratePerDay;
  const custom = choice.ratePerDay !== undefined;
  const ring = accent === "a" ? "focus:ring-stone-400" : "focus:ring-stone-900";

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wider text-stone-500">
        {label}
      </label>
      <select
        id={selectId}
        value={option.roomId}
        onChange={(e) => onSelectRoom(e.target.value)}
        className={`h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 shadow-sm focus:outline-none focus:ring-2 ${ring}`}
      >
        {options.map((o) => (
          <option key={o.roomId} value={o.roomId}>
            {o.label} · ₹{(o.ratePerDay / 100).toLocaleString("en-IN")} per day
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <label htmlFor={rateId} className="text-xs text-stone-500">
          Rate per day
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-stone-500">₹</span>
          <input
            id={rateId}
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={rate / 100}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0) onSetRate(rupees(n));
            }}
            className={`h-9 w-32 rounded-lg border border-stone-300 bg-white pl-6 pr-2 text-sm tabular-nums text-stone-900 shadow-sm focus:outline-none focus:ring-2 ${ring}`}
          />
        </div>
        {custom ? <ProvenanceBadge provenance="userEntered" /> : null}
      </div>
    </div>
  );
}
