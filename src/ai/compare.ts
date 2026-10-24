import type { PolicyRuleset } from "@/engine/types";
import type { RuleProposal } from "./types";

export interface FieldCheck {
  field: string;
  expected: unknown;
  actual: unknown;
  same: boolean;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compares a proposal's fields with the human-reviewed ruleset for the same wording. Measurement, not judgement. */
export function proposalFieldChecks(proposal: RuleProposal, reviewed: PolicyRuleset): FieldCheck[] {
  const r = reviewed.rules;
  const checks: FieldCheck[] = [];
  const push = (field: string, expected: unknown, actual: unknown) => checks.push({ field, expected, actual, same: same(expected, actual) });
  switch (proposal.kind) {
    case "roomLimit":
      push("roomLimit.clauseId", r.roomLimit?.source.clauseId, proposal.clauseId);
      push("roomLimit.basis", r.roomLimit?.basis, proposal.proposed.basis);
      break;
    case "icuLimit":
      push("icuLimit.clauseId", r.icuLimit?.source.clauseId, proposal.clauseId);
      push("icuLimit.basis", r.icuLimit?.basis, proposal.proposed.basis);
      break;
    case "proportionateDeduction":
      push("proportionateDeduction.clauseId", r.proportionateDeduction?.source.clauseId, proposal.clauseId);
      push("proportionateDeduction.conditions", r.proportionateDeduction?.conditions.map((c) => c.conditionId) ?? [], proposal.proposed.conditions ?? []);
      push("proportionateDeduction.triggers", r.proportionateDeduction?.triggers ?? ["room"], proposal.proposed.triggers ?? ["room"]);
      break;
    case "itemClasses":
      push("itemClasses.clauseId", r.itemClasses?.source.clauseId, proposal.clauseId);
      push("itemClasses.included", [...(r.itemClasses?.included ?? [])].sort(), [...(proposal.proposed.included ?? [])].sort());
      push("itemClasses.excluded", [...(r.itemClasses?.excluded ?? [])].sort(), [...(proposal.proposed.excluded ?? [])].sort());
      break;
    case "copay":
      push("copay.clauseId", r.copay?.source.clauseId, proposal.clauseId);
      push("copay.percent", r.copay?.percent, proposal.proposed.percent);
      break;
    case "sumInsuredCap":
      push("sumInsuredCap.clauseId", r.sumInsuredCap?.source.clauseId, proposal.clauseId);
      break;
  }
  return checks;
}
