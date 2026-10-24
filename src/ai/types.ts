import type { BillCategory, LimitBasis, RuleCondition } from "@/engine/types";

export type ProposalKind = "roomLimit" | "icuLimit" | "proportionateDeduction" | "itemClasses" | "copay" | "sumInsuredCap";

export interface ProposalProvenance {
  provider: "claude-cached" | "claude-live";
  model: string;
  producedOn: string;
  note: string;
}

export interface ProposedFields {
  basis?: LimitBasis;
  conditions?: RuleCondition["conditionId"][];
  triggers?: ("room" | "icu")[];
  included?: BillCategory[];
  excluded?: BillCategory[];
  percent?: number;
}

/** A candidate rule. It becomes a rule only after its quote is verified and a person confirms it. */
export interface RuleProposal {
  id: string;
  kind: ProposalKind;
  clauseId: string;
  /** An excerpt the model claims is in the clause. Checked verbatim. */
  quotedText: string;
  rationale: string;
  proposed: ProposedFields;
  provenance?: ProposalProvenance;
}

export interface Verification {
  clauseExists: boolean;
  quoteFound: boolean;
  problems: string[];
}

export interface VerifiedProposal {
  proposal: RuleProposal;
  verification: Verification;
}
