import { evaluate } from "@/engine/evaluate";
import type { Money } from "@/engine/money";
import type { CaseInputs, Range, SimulationResult } from "@/engine/types";

export interface LadderRow {
  roomId: string;
  label: string;
  ratePerDay: Money;
  roomExcess: Money | null;
  withinRoomLimit: boolean | null;
  calculated: Money;
  conditional: Range | null;
  unclassified: Money;
  scenarioTotal: Money;
  result: SimulationResult;
}

export interface Ladder {
  rows: LadderRow[];
  eligiblePerDay: Money | null;
  /** The highest-rate room whose rate is within the room-rent limit, or null when none is or the limit is unknown. */
  bestWithinLimitRoomId: string | null;
}

/** Every room option of the estimate evaluated on the same policy, lowest rate first. */
export function buildLadder(inputs: CaseInputs): Ladder {
  const options = [...inputs.estimate.roomOptions].sort((a, b) => a.ratePerDay - b.ratePerDay);
  const rows: LadderRow[] = options.map((o) => {
    const result = evaluate(inputs, { scenarioId: `ladder-${o.roomId}`, label: o.label, roomId: o.roomId });
    const eligible = result.roomLimit.eligiblePerDay;
    return {
      roomId: o.roomId,
      label: o.label,
      ratePerDay: o.ratePerDay,
      roomExcess: result.roomExcess.value,
      withinRoomLimit: eligible === null ? null : o.ratePerDay <= eligible,
      calculated: result.totals.calculatedDeductions,
      conditional: result.totals.conditionalDeductions,
      unclassified: result.totals.unclassifiedAmount,
      scenarioTotal: result.totals.scenarioTotal,
      result,
    };
  });
  const eligiblePerDay = rows[0]?.result.roomLimit.eligiblePerDay ?? null;
  const within = rows.filter((r) => r.withinRoomLimit === true);
  return { rows, eligiblePerDay, bestWithinLimitRoomId: within.length ? within[within.length - 1].roomId : null };
}
