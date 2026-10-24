/**
 * CACHED rule proposals for the Arogya Sanjeevani (New India) wording.
 *
 * Provenance, stated plainly: these proposals were written by Claude
 * (Fable 5.1) during the build session on 24 October 2026, reading the
 * extracted wording offline. They were NOT produced by an API call; the live
 * adapter is off by default and was not exercised. They are what the
 * ruleset builder shows when no key is configured. Every quote is checked
 * verbatim against the clause text before a person can confirm it, and a
 * confirmed proposal becomes a rule only through that confirmation.
 */

import { rupees } from "@/engine/money";
import type { RuleProposal } from "@/ai/types";

export const NIA_PROPOSALS_PROVENANCE = {
  provider: "claude-cached" as const,
  model: "claude-fable-5-1 (build session, offline; not an API call)",
  producedOn: "2026-10-24",
  note: "Cached proposals. The live adapter (CLAIM_SACH_LLM_PROVIDER, ANTHROPIC_API_KEY) is off and was not exercised.",
};

export const NIA_PROPOSALS: RuleProposal[] = [
  {
    id: "p-room-limit",
    kind: "roomLimit",
    clauseId: "4.1(a)",
    quotedText: "up to 2% of the sum insured subject to maximum of Rs.5000/-, per day",
    rationale: "The clause caps room, boarding and nursing at a percentage of the sum insured with a rupee ceiling per day; both figures are explicit.",
    proposed: { basis: { kind: "percentOfSumInsuredPerDay", percent: 2, capPerDay: rupees(5_000) } },
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
  {
    id: "p-icu-limit",
    kind: "icuLimit",
    clauseId: "4.1(b)",
    quotedText: "up to 5% of sum insured subject to maximum of Rs.10,000/- per day",
    rationale: "A separate per-day limit for ICU and ICCU, again a percentage with a rupee ceiling.",
    proposed: { basis: { kind: "percentOfSumInsuredPerDay", percent: 5, capPerDay: rupees(10_000) } },
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
  {
    id: "p-proportion",
    kind: "proportionateDeduction",
    clauseId: "4.1.1 Note (b)",
    quotedText: "shall be effected in the same proportion as the admissible rate per day bears to the actual rate per day of Room Rent/ICU/ICCU charges",
    rationale: "The note triggers on admission to a room or an ICU/ICCU above the limits, and states the ratio as admissible rate over actual rate. No differential-billing condition appears in this wording.",
    proposed: { conditions: [], triggers: ["room", "icu"] },
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
  {
    id: "p-item-classes",
    kind: "itemClasses",
    clauseId: "4.1.1 Note (b)",
    quotedText: "all other expenses incurred at the Hospital, with the exception of cost of medicines",
    rationale: "The reduced class is everything else billed by the hospital except medicines. Consumables are not mentioned, so a line that mixes medicines and consumables is uncertain; a reviewer should decide whether administrative charges are covered expenses at all.",
    proposed: {
      included: ["nursing", "surgeonFees", "anaesthetistFees", "consultantFees", "operationTheatre", "implant", "diagnostics", "physiotherapy", "hospitalAdmin"],
      excluded: ["pharmacyConsumables"],
    },
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
  {
    id: "p-copay",
    kind: "copay",
    clauseId: "9.5",
    quotedText: "subject to a Co-Payment of 5% applicable to claim amount admissible and payable",
    rationale: "A flat co-payment on every claim's admissible amount.",
    proposed: { percent: 5 },
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
  {
    id: "p-si-cap",
    kind: "sumInsuredCap",
    clauseId: "2",
    quotedText: "Maximum liability of the Company under all such Claims during each Policy Year shall be the Sum Insured",
    rationale: "The operative clause caps the policy-year liability at the sum insured plus cumulative bonus.",
    proposed: {},
    provenance: NIA_PROPOSALS_PROVENANCE,
  },
];
