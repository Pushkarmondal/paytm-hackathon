/**
 * Screen model: app state, its reducer, and the pure functions that turn
 * engine results into what the screens show. No React, no DOM, fully tested.
 */

import { type Money } from "@/engine/money";
import type {
  BillItem,
  CaseInputs,
  Confirmations,
  HospitalEstimate,
  PolicyRuleset,
  PolicySchedule,
  Range,
  ResultState,
  Scenario,
  SimulationResult,
  Trace,
  UncertaintyReason,
  UserClassification,
} from "@/engine/types";
import { buildRulesetFromProposals, verifyProposals, type RuleProposal } from "@/ai";
import { NIA_CLAUSES, arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { NIA_PROPOSALS } from "@/fixtures/arogya-sanjeevani-nia/llm-proposals";
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
export type PolicyId = "demo" | "arogya";

export interface PolicyOption {
  id: PolicyId;
  label: string;
  description: string;
}

export const POLICY_OPTIONS: readonly PolicyOption[] = [
  { id: "demo", label: "Claim Sach Demo Health Policy (synthetic)", description: "Invented wording with a defined Associated Medical Expenses class and a differential-billing condition. Not issued by any insurer." },
  { id: "arogya", label: "Arogya Sanjeevani, The New India Assurance (IRDAI-hosted, partially encoded)", description: "A real wording, UIN NIAHLIP20165V011920, downloaded from irdai.gov.in and quoted verbatim. Only the room, ICU, proportionate-payment and co-payment clauses are encoded. The schedule is synthetic." },
];

export interface RoomChoice {
  roomId: string;
  ratePerDay?: Money;
}

export interface OpenTrace {
  title: string;
  trace: Trace;
}

export type UploadTarget = "ruleset" | "schedule" | "estimate";

export interface UploadRecord<T> {
  fileName: string;
  warnings: string[];
  value: T;
}

export interface Uploads {
  ruleset?: UploadRecord<PolicyRuleset>;
  schedule?: UploadRecord<PolicySchedule>;
  estimate?: (UploadRecord<HospitalEstimate> & { kind: "full" }) | (UploadRecord<BillItem[]> & { kind: "items" });
}

export interface AppState {
  screen: Screen;
  policy: PolicyId;
  variant: VariantId;
  plannedRoom: RoomChoice;
  comparisonRoom: RoomChoice;
  confirmations: Confirmations;
  edits: { roomDays?: number; sumInsured?: Money };
  uploads: Uploads;
  uploadErrors: Partial<Record<UploadTarget, { fileName: string; message: string }>>;
  builder: { decisions: Record<string, "confirmed" | "rejected"> };
  openTrace: OpenTrace | null;
}

/** The cached proposals available for a bundled policy. Only the real wording has any. */
export function proposalsFor(policy: PolicyId): RuleProposal[] {
  return policy === "arogya" ? NIA_PROPOSALS : [];
}

export type Action =
  | { type: "setScreen"; screen: Screen }
  | { type: "selectRoom"; side: Side; roomId: string }
  | { type: "setRate"; side: Side; ratePerDay: Money }
  | { type: "confirmDifferentialBilling"; value: boolean | null }
  | { type: "classifyItem"; itemId: string; classification: UserClassification | null }
  | { type: "setVariant"; variant: VariantId }
  | { type: "setPolicy"; policy: PolicyId }
  | { type: "setRoomDays"; days: number }
  | { type: "setSumInsured"; sumInsured: Money }
  | { type: "openTrace"; title: string; trace: Trace }
  | { type: "closeTrace" }
  | { type: "uploadRuleset"; ruleset: PolicyRuleset; fileName: string; warnings: string[] }
  | { type: "uploadSchedule"; schedule: PolicySchedule; fileName: string; warnings: string[] }
  | { type: "uploadEstimate"; estimate: HospitalEstimate; fileName: string; warnings: string[] }
  | { type: "uploadEstimateItems"; items: BillItem[]; fileName: string; warnings: string[] }
  | { type: "uploadFailed"; target: UploadTarget; fileName: string; message: string }
  | { type: "clearUploads" }
  | { type: "decideProposal"; proposalId: string; decision: "confirmed" | "rejected" }
  | { type: "applyProposals" }
  | { type: "clearDecisions" }
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
    policy: "demo",
    variant: "standard",
    plannedRoom: { roomId: ROOM_SINGLE },
    comparisonRoom: { roomId: ROOM_TWIN },
    confirmations: {},
    edits: {},
    uploads: {},
    uploadErrors: {},
    builder: { decisions: {} },
    openTrace: null,
  };
}

function withoutError(state: AppState, target: UploadTarget): AppState["uploadErrors"] {
  const errors = { ...state.uploadErrors };
  delete errors[target];
  return errors;
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
    case "setPolicy": {
      if (action.policy === state.policy) return state;
      const confirmations = { ...state.confirmations };
      delete confirmations.hospitalFollowsDifferentialBilling;
      return { ...state, policy: action.policy, confirmations };
    }
    case "setRoomDays":
      return { ...state, edits: { ...state.edits, roomDays: action.days } };
    case "setSumInsured":
      return { ...state, edits: { ...state.edits, sumInsured: action.sumInsured } };
    case "openTrace":
      return { ...state, openTrace: { title: action.title, trace: action.trace } };
    case "closeTrace":
      return { ...state, openTrace: null };
    case "uploadRuleset":
      return {
        ...state,
        uploads: { ...state.uploads, ruleset: { fileName: action.fileName, warnings: action.warnings, value: action.ruleset } },
        uploadErrors: withoutError(state, "ruleset"),
      };
    case "uploadSchedule":
      return {
        ...state,
        uploads: { ...state.uploads, schedule: { fileName: action.fileName, warnings: action.warnings, value: action.schedule } },
        uploadErrors: withoutError(state, "schedule"),
      };
    case "uploadEstimate": {
      const options = action.estimate.roomOptions;
      return {
        ...state,
        uploads: { ...state.uploads, estimate: { kind: "full", fileName: action.fileName, warnings: action.warnings, value: action.estimate } },
        uploadErrors: withoutError(state, "estimate"),
        comparisonRoom: { roomId: options[0].roomId },
        plannedRoom: { roomId: options[Math.min(1, options.length - 1)].roomId },
      };
    }
    case "uploadEstimateItems":
      return {
        ...state,
        uploads: { ...state.uploads, estimate: { kind: "items", fileName: action.fileName, warnings: action.warnings, value: action.items } },
        uploadErrors: withoutError(state, "estimate"),
      };
    case "uploadFailed":
      return { ...state, uploadErrors: { ...state.uploadErrors, [action.target]: { fileName: action.fileName, message: action.message } } };
    case "clearUploads": {
      const fresh = initialState();
      return { ...state, uploads: {}, uploadErrors: {}, plannedRoom: fresh.plannedRoom, comparisonRoom: fresh.comparisonRoom };
    }
    case "decideProposal":
      return { ...state, builder: { decisions: { ...state.builder.decisions, [action.proposalId]: action.decision } } };
    case "clearDecisions":
      return { ...state, builder: { decisions: {} } };
    case "applyProposals": {
      const confirmed = proposalsFor(state.policy).filter((p) => state.builder.decisions[p.id] === "confirmed");
      const usable = verifyProposals(confirmed, NIA_CLAUSES).filter((v) => v.verification.quoteFound).map((v) => v.proposal);
      if (usable.length === 0) return state;
      const base = arogyaInputs().ruleset;
      const ruleset = buildRulesetFromProposals({ metadata: base.metadata, clauses: NIA_CLAUSES, fixtureVersion: `builder-${usable.length}-confirmed` }, usable);
      return {
        ...state,
        uploads: { ...state.uploads, ruleset: { fileName: `builder: ${usable.length} confirmed proposal${usable.length === 1 ? "" : "s"}`, warnings: [], value: ruleset } },
        uploadErrors: withoutError(state, "ruleset"),
      };
    }
    case "reset":
      return initialState();
  }
}

/** Engine inputs for the current variant, edits and confirmations. */
export function buildInputs(state: AppState): CaseInputs {
  const base = state.policy === "arogya" ? arogyaInputs() : demoInputs();
  let { ruleset, schedule, estimate } = base;
  switch (state.policy === "demo" ? state.variant : "standard") {
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
  if (state.uploads.ruleset) ruleset = state.uploads.ruleset.value;
  if (state.uploads.schedule) schedule = state.uploads.schedule.value;
  if (state.uploads.estimate?.kind === "full") {
    estimate = state.uploads.estimate.value;
  } else if (state.uploads.estimate?.kind === "items") {
    estimate = { ...estimate, estimateId: `${estimate.estimateId}-uploaded-items`, items: state.uploads.estimate.value, provenance: "upload" };
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
