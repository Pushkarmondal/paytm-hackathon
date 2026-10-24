/**
 * Screen model: app state, its reducer, and the pure functions that turn
 * engine results into what the screens show. No React, no DOM, fully tested.
 */

import { type Money } from "@/engine/money";
import type {
  CaseInputs,
  Confirmations,
  Range,
  ResultState,
  Scenario,
  SimulationResult,
  Trace,
  UncertaintyReason,
  UserClassification,
} from "@/engine/types";
import {
  DEMO_RULESET_WITHOUT_DEDUCTION,
  DEMO_SCHEDULE_CONTRADICTORY,
  ROOM_SINGLE,
  ROOM_TWIN,
  demoInputs,
} from "@/fixtures/demo-policy";
import { formatInr } from "@/lib/format-inr";

export type Screen = "overview" | "twin" | "why" | "uncertainty" | "review";
export type Side = "planned" | "comparison";
export type VariantId = "standard" | "scheduleMissing" | "scheduleContradictory" | "noDeductionClause";

export interface RoomChoice {
  roomId: string;
  ratePerDay?: Money;
}

export interface OpenTrace {
  title: string;
  trace: Trace;
}

export interface AppState {
  screen: Screen;
  variant: VariantId;
  plannedRoom: RoomChoice;
  comparisonRoom: RoomChoice;
  confirmations: Confirmations;
  edits: { roomDays?: number; sumInsured?: Money };
  openTrace: OpenTrace | null;
}

export type Action =
  | { type: "setScreen"; screen: Screen }
  | { type: "selectRoom"; side: Side; roomId: string }
  | { type: "setRate"; side: Side; ratePerDay: Money }
  | { type: "confirmDifferentialBilling"; value: boolean | null }
  | { type: "classifyItem"; itemId: string; classification: UserClassification | null }
  | { type: "setVariant"; variant: VariantId }
  | { type: "setRoomDays"; days: number }
  | { type: "setSumInsured"; sumInsured: Money }
  | { type: "openTrace"; title: string; trace: Trace }
  | { type: "closeTrace" }
  | { type: "reset" };

export interface DemoVariant {
  id: VariantId;
  label: string;
  description: string;
}

export const DEMO_VARIANTS: readonly DemoVariant[] = [
  { id: "standard", label: "Standard demo case", description: "Wording, schedule and estimate as seeded." },
  { id: "scheduleMissing", label: "Policy schedule missing", description: "The wording refers to the schedule for the Sum Insured; without it no limit can be determined." },
  { id: "scheduleContradictory", label: "Schedule contradicts wording", description: "The schedule prints ₹6,000 per day while the wording gives 1% of ₹5,00,000. Review required." },
  { id: "noDeductionClause", label: "Wording without a deduction clause", description: "The same policy without clause C3: the room limit still applies, the proportionate deduction does not." },
];

export function initialState(): AppState {
  return {
    screen: "overview",
    variant: "standard",
    plannedRoom: { roomId: ROOM_SINGLE },
    comparisonRoom: { roomId: ROOM_TWIN },
    confirmations: {},
    edits: {},
    openTrace: null,
  };
}

function roomKey(side: Side): "plannedRoom" | "comparisonRoom" {
  return side === "planned" ? "plannedRoom" : "comparisonRoom";
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setScreen":
      return { ...state, screen: action.screen };
    case "selectRoom":
      return { ...state, [roomKey(action.side)]: { roomId: action.roomId } };
    case "setRate":
      return { ...state, [roomKey(action.side)]: { ...state[roomKey(action.side)], ratePerDay: action.ratePerDay } };
    case "confirmDifferentialBilling": {
      const confirmations = { ...state.confirmations };
      if (action.value === null) delete confirmations.hospitalFollowsDifferentialBilling;
      else confirmations.hospitalFollowsDifferentialBilling = action.value;
      return { ...state, confirmations };
    }
    case "classifyItem": {
      const itemClassifications = { ...state.confirmations.itemClassifications };
      if (action.classification === null) delete itemClassifications[action.itemId];
      else itemClassifications[action.itemId] = action.classification;
      return { ...state, confirmations: { ...state.confirmations, itemClassifications } };
    }
    case "setVariant":
      return { ...state, variant: action.variant };
    case "setRoomDays":
      return { ...state, edits: { ...state.edits, roomDays: action.days } };
    case "setSumInsured":
      return { ...state, edits: { ...state.edits, sumInsured: action.sumInsured } };
    case "openTrace":
      return { ...state, openTrace: { title: action.title, trace: action.trace } };
    case "closeTrace":
      return { ...state, openTrace: null };
    case "reset":
      return initialState();
  }
}

/** Engine inputs for the current variant, edits and confirmations. */
export function buildInputs(state: AppState): CaseInputs {
  const base = demoInputs();
  let { ruleset, schedule, estimate } = base;
  switch (state.variant) {
    case "scheduleMissing":
      schedule = null;
      break;
    case "scheduleContradictory":
      schedule = DEMO_SCHEDULE_CONTRADICTORY;
      break;
    case "noDeductionClause":
      ruleset = DEMO_RULESET_WITHOUT_DEDUCTION;
      break;
    case "standard":
      break;
  }
  if (state.edits.roomDays !== undefined) {
    estimate = { ...estimate, roomDays: state.edits.roomDays, provenance: "userEntered" };
  }
  if (state.edits.sumInsured !== undefined && schedule) {
    schedule = { ...schedule, sumInsured: state.edits.sumInsured, provenance: "userEntered" };
  }
  return { ruleset, schedule, estimate, confirmations: state.confirmations };
}

export function scenarioFor(state: AppState, side: Side): Scenario {
  const choice = state[roomKey(side)];
  const scenario: Scenario = {
    scenarioId: side,
    label: side === "planned" ? "Planned room" : "Comparison room",
    roomId: choice.roomId,
  };
  if (choice.ratePerDay !== undefined) scenario.roomRatePerDay = choice.ratePerDay;
  return scenario;
}

export interface Headline {
  state: SimulationResult["overallState"];
  calculated: Money;
  conditional: Range | null;
  unclassified: Money;
  unclassifiedCount: number;
  summary: string;
}

export function headlineFor(result: SimulationResult): Headline {
  const { totals, overallState } = result;
  let summary: string;
  if (overallState === "cannotDetermine") {
    summary = "The potential deductions cannot be determined from these inputs";
  } else if (overallState === "reviewRequired") {
    summary = "Review required: the policy documents contradict each other";
  } else {
    const parts = [`${formatInr(totals.calculatedDeductions)} calculated`];
    if (totals.conditionalDeductions) {
      parts.push(`plus ${formatInr(totals.conditionalDeductions.low)} to ${formatInr(totals.conditionalDeductions.high)} conditional`);
    }
    if (totals.unclassifiedCount > 0) {
      parts.push(`plus ${formatInr(totals.unclassifiedAmount)} not classified`);
    }
    summary = parts.join(", ");
  }
  return {
    state: overallState,
    calculated: totals.calculatedDeductions,
    conditional: totals.conditionalDeductions,
    unclassified: totals.unclassifiedAmount,
    unclassifiedCount: totals.unclassifiedCount,
    summary,
  };
}

export interface UncertaintyGroups {
  user: UncertaintyReason[];
  hospital: UncertaintyReason[];
  insurer: UncertaintyReason[];
  none: UncertaintyReason[];
  notModelled: string[];
  total: number;
}

export function groupUncertainties(result: SimulationResult): UncertaintyGroups {
  const groups: UncertaintyGroups = { user: [], hospital: [], insurer: [], none: [], notModelled: [...result.notModelled], total: result.uncertainties.length };
  for (const u of result.uncertainties) groups[u.resolvableBy].push(u);
  return groups;
}

const STATE_LABELS: Record<ResultState, string> = {
  calculated: "Calculated",
  conditional: "Conditional",
  unknown: "Cannot determine",
  excluded: "Not subject to deduction",
  requiresInsurerConfirmation: "Requires insurer confirmation",
  reviewRequired: "Review required",
};

export function stateLabel(state: ResultState): string {
  return STATE_LABELS[state];
}
