/**
 * Claim Sach rules engine: the typed contract.
 *
 * Everything in this file is plain data. The engine never performs I/O and
 * never talks to a language model. Amounts are integer paise (see money.ts);
 * an unknown amount is represented by the absence of a Money value together
 * with an UncertaintyReason, never by zero.
 */

import type { Money, Ratio } from "./money";

export const ENGINE_VERSION = "0.1.0";

/** Where a value came from. Shown beside every input in a trace. */
export type Provenance = "fixture" | "upload" | "userConfirmed" | "userEntered";

/** A pointer to the exact text that justifies a rule or a classification. */
export interface SourceRef {
  documentId: string;
  documentTitle: string;
  version: string;
  page: number;
  clauseId: string;
  quotedText: string;
}

export type IssuerInfo =
  | { kind: "synthetic"; label: string }
  | { kind: "insurer"; name: string; uin?: string; sourceUrl: string };

export interface PolicyMetadata {
  policyId: string;
  name: string;
  issuer: IssuerInfo;
  wordingVersion: string;
  effectiveDate: string;
  sourceDocument: { documentId: string; title: string; url?: string };
  verification?: VerificationRecord;
}

export interface Clause {
  id: string;
  title: string;
  page: number;
  text: string;
}

/** Categories a hospital estimate line can carry. "other" means the line could not be categorised. */
export type BillCategory =
  | "roomRent"
  | "icu"
  | "nursing"
  | "surgeonFees"
  | "anaesthetistFees"
  | "consultantFees"
  | "operationTheatre"
  | "implant"
  | "pharmacyConsumables"
  | "diagnostics"
  | "physiotherapy"
  | "hospitalAdmin"
  | "other";

export type LimitBasis =
  | { kind: "percentOfSumInsuredPerDay"; percent: number; capPerDay?: Money }
  | { kind: "fixedPerDay"; amount: Money }
  | { kind: "scheduleDefined" };

export interface LimitRule {
  ruleId: string;
  appliesTo: "room" | "icu";
  basis: LimitBasis;
  source: SourceRef;
}

export interface RuleCondition {
  conditionId: "hospitalFollowsDifferentialBilling";
  description: string;
  resolvableBy: "user" | "hospital" | "insurer" | "none";
}

export interface ProportionateDeductionRule {
  ruleId: string;
  affectedClass: "associatedMedicalExpenses";
  conditions: RuleCondition[];
  /** Which per-day limits, when exceeded, trigger the proportion. Default: ["room"]. */
  triggers?: ("room" | "icu")[];
  source: SourceRef;
}

export interface CopayRule {
  ruleId: string;
  percent: number;
  source: SourceRef;
}

/** A policy-specific fact the fixture author wants surfaced, such as a wording that predates a regulatory norm. */
export interface PolicyCaveat {
  code: UncertaintyCode;
  text: string;
  affectedCategories: BillCategory[];
  resolvableBy: "user" | "hospital" | "insurer" | "none";
  whatWouldResolveIt: string;
}

/** The policy's own definition of which categories the deduction touches. */
export interface ItemClassRule {
  ruleId: string;
  included: BillCategory[];
  excluded: BillCategory[];
  /** Why a category is deliberately left unclassified under this wording. */
  notes?: Partial<Record<BillCategory, string>>;
  source: SourceRef;
}

/** How a real wording was obtained and checked. Shown to the user; never implied. */
export interface VerificationRecord {
  url: string;
  sha256: string;
  fetchedOn: string;
  pages: number;
  extractedWith: string;
  encodedClauses: string[];
  note: string;
}

export interface PolicyRuleset {
  schemaVersion: string;
  fixtureVersion: string;
  metadata: PolicyMetadata;
  clauses: Clause[];
  rules: {
    roomLimit?: LimitRule;
    icuLimit?: LimitRule;
    proportionateDeduction?: ProportionateDeductionRule;
    itemClasses?: ItemClassRule;
    sumInsuredCap?: { ruleId: string; source: SourceRef };
    /** Present only when the wording says what happens if the eligible room category is unavailable. */
    roomUnavailabilityClause?: { ruleId: string; source: SourceRef };
    copay?: CopayRule;
  };
  /** Caveats make the affected items' deductions conditional on insurer confirmation. */
  caveats?: PolicyCaveat[];
  /** Notices are surfaced as uncertainties without changing any amount. */
  notices?: PolicyCaveat[];
}

export interface ScheduleStatedLimit {
  amountPerDay: Money;
  source: SourceRef;
}

export interface PolicySchedule {
  scheduleId: string;
  policyId: string;
  sumInsured: Money;
  insuredLabel: string;
  policyPeriod: { from: string; to: string };
  /** A figure printed on the schedule. It may agree with or contradict the wording. */
  roomLimitPerDay?: ScheduleStatedLimit;
  icuLimitPerDay?: ScheduleStatedLimit;
  provenance: Provenance;
}

export interface RoomOption {
  roomId: string;
  label: string;
  ratePerDay: Money;
}

export interface BillItem {
  itemId: string;
  label: string;
  category: BillCategory;
  amount: Money;
  /** Present when the line is billed per day (ICU, for example). Needed for per-day limits. */
  perDay?: { days: number; ratePerDay: Money };
}

export type DifferentialBillingStatement = "yes" | "no" | "notStated";

export interface HospitalEstimate {
  estimateId: string;
  hospitalLabel: string;
  procedureLabel: string;
  roomDays: number;
  roomOptions: RoomOption[];
  /** Lines other than room rent. Room rent is derived from the selected room. */
  items: BillItem[];
  differentialBilling: DifferentialBillingStatement;
  provenance: Provenance;
}

export type UserClassification = "includedInDeduction" | "excludedFromDeduction";

/** Facts the user confirmed or supplied on the Input review screen. */
export interface Confirmations {
  hospitalFollowsDifferentialBilling?: boolean;
  itemClassifications?: Record<string, UserClassification>;
}

export interface CaseInputs {
  ruleset: PolicyRuleset;
  schedule: PolicySchedule | null;
  estimate: HospitalEstimate;
  confirmations: Confirmations;
}

export interface Scenario {
  scenarioId: string;
  label: string;
  roomId: string;
  /** Overrides the room option's rate when the user edits it. */
  roomRatePerDay?: Money;
}

export type ResultState =
  | "calculated"
  | "conditional"
  | "unknown"
  | "excluded"
  | "requiresInsurerConfirmation"
  | "reviewRequired";

export interface Range {
  low: Money;
  high: Money;
  basis: string;
}

export type UncertaintyCode =
  | "SCHEDULE_MISSING"
  | "SCHEDULE_CONTRADICTS_WORDING"
  | "DIFFERENTIAL_BILLING_NOT_ESTABLISHED"
  | "ITEM_NOT_CLASSIFIED"
  | "WORDING_SILENT_ON_ROOM_UNAVAILABILITY"
  | "RULE_ABSENT"
  | "LIMIT_RULE_ABSENT"
  | "ICU_RATE_NOT_STATED"
  | "RATIO_AMBIGUOUS_ROOM_AND_ICU"
  | "WORDING_PREDATES_2020_NORMS"
  | "POLICY_CAVEAT";

export interface UncertaintyReason {
  code: UncertaintyCode;
  text: string;
  affectedItemIds: string[];
  /** Only present when both bounds follow from the finite outcomes of the open question. */
  amountAtStake?: Range;
  resolvableBy: "user" | "hospital" | "insurer" | "none";
  whatWouldResolveIt: string;
}

export type TraceValue =
  | { kind: "money"; paise: Money }
  | { kind: "days"; days: number }
  | { kind: "ratio"; ratio: Ratio }
  | { kind: "percent"; percent: number }
  | { kind: "text"; text: string }
  | { kind: "boolean"; value: boolean };

export interface TraceInput {
  name: string;
  value: TraceValue;
  provenance: Provenance;
}

export interface TraceOutput {
  state: ResultState;
  value: Money | null;
  range?: Range;
}

export interface Trace {
  ruleId: string;
  ruleName: string;
  inputs: TraceInput[];
  source: SourceRef;
  /** Human-readable formula, e.g. "deduction = item × (1 − 5,000 ÷ 7,500)". */
  formula: string;
  /** Deterministic operation identifier the tests check. */
  operation: string;
  output: TraceOutput;
  assumptions: UncertaintyReason[];
}

export type ItemClassification =
  | "includedInDeduction"
  | "excludedFromDeduction"
  | "unknown"
  | "roomRent"
  | "icu";

export interface ClassifiedItem extends BillItem {
  classification: ItemClassification;
  classificationSource: SourceRef | null;
  classificationProvenance: Provenance;
}

export interface ItemResult extends ClassifiedItem {
  deduction: TraceOutput;
  trace: Trace | null;
}

export interface LimitResult {
  state: ResultState;
  eligiblePerDay: Money | null;
  trace: Trace | null;
}

export interface ExcessResult {
  state: ResultState;
  value: Money | null;
  trace: Trace | null;
}

export type DeductionApplicability =
  | "applies"
  | "conditional"
  | "withinEntitlement"
  | "conditionFailed"
  | "ruleAbsent"
  | "undetermined";

export interface DeductionRuleResult {
  applicability: DeductionApplicability;
  ratio: Ratio | null;
  /** Which limit was exceeded and drove the proportion. */
  trigger: "room" | "icu" | "both" | null;
  trace: Trace | null;
}

export interface CopayResult {
  state: ResultState;
  value: Money | null;
  range?: Range;
  trace: Trace | null;
}

export interface SimulationTotals {
  roomRent: Money;
  nonRoomItems: Money;
  scenarioTotal: Money;
  calculatedDeductions: Money;
  conditionalDeductions: Range | null;
  unclassifiedAmount: Money;
  unclassifiedCount: number;
}

export type OverallState = "calculated" | "conditional" | "reviewRequired" | "cannotDetermine";

export interface SimulationResult {
  engineVersion: string;
  fixtureVersion: string;
  policy: { policyId: string; name: string; issuer: IssuerInfo; wordingVersion: string };
  scenario: {
    scenarioId: string;
    label: string;
    roomId: string;
    roomLabel: string;
    ratePerDay: Money;
    roomDays: number;
    rateProvenance: Provenance;
  };
  roomLimit: LimitResult;
  roomExcess: ExcessResult;
  icuLimit: LimitResult;
  icuExcess: ExcessResult;
  deductionRule: DeductionRuleResult;
  copay: CopayResult;
  items: ItemResult[];
  totals: SimulationTotals;
  uncertainties: UncertaintyReason[];
  notModelled: string[];
  overallState: OverallState;
}
