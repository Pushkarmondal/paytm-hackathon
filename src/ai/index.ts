/**
 * The AI seam. A model may PROPOSE rules from a PUBLIC policy wording; it
 * never decides anything. Every proposal's quote is checked verbatim against
 * the clause, a person confirms each one, and only then does it become a rule
 * with the full clause as its evidence. Nothing personal is ever sent: the
 * prompt carries clause text only.
 */

import { z } from "zod";
import type { Clause, PolicyMetadata, PolicyRuleset, SourceRef } from "@/engine/types";
import { billCategorySchema } from "@/ingestion/schemas";
import type { ProposalKind, RuleProposal, VerifiedProposal } from "./types";

export type { ProposalKind, ProposalProvenance, ProposedFields, RuleProposal, VerifiedProposal, Verification } from "./types";

function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function verifyProposals(proposals: readonly RuleProposal[], clauses: readonly Clause[]): VerifiedProposal[] {
  return proposals.map((proposal) => {
    const clause = clauses.find((c) => c.id === proposal.clauseId);
    const problems: string[] = [];
    const clauseExists = clause !== undefined;
    if (!clause) problems.push(`clause ${proposal.clauseId} is not in the wording`);
    const quoteFound = clause !== undefined && proposal.quotedText.trim().length > 0 && normalise(clause.text).includes(normalise(proposal.quotedText));
    if (clause && !quoteFound) problems.push(`the quote is not found verbatim in clause ${proposal.clauseId}`);
    return { proposal, verification: { clauseExists, quoteFound, problems } };
  });
}

export interface BuildTarget {
  metadata: PolicyMetadata;
  clauses: readonly Clause[];
  fixtureVersion: string;
}

function sourceFor(target: BuildTarget, clauseId: string): SourceRef {
  const clause = target.clauses.find((c) => c.id === clauseId)!;
  return {
    documentId: target.metadata.sourceDocument.documentId,
    documentTitle: target.metadata.sourceDocument.title,
    version: target.metadata.wordingVersion,
    page: clause.page,
    clauseId: clause.id,
    quotedText: clause.text,
  };
}

/** Confirmed proposals → a ruleset whose evidence is the full text of each cited clause. Throws on an unverified proposal. */
export function buildRulesetFromProposals(target: BuildTarget, confirmed: readonly RuleProposal[]): PolicyRuleset {
  const verified = verifyProposals(confirmed, target.clauses);
  const bad = verified.find((v) => !v.verification.quoteFound);
  if (bad) {
    throw new Error(`Proposal ${bad.proposal.id} is not verified: its quote is not verbatim in clause ${bad.proposal.clauseId}`);
  }
  const ruleset: PolicyRuleset = {
    schemaVersion: "1",
    fixtureVersion: target.fixtureVersion,
    metadata: target.metadata,
    clauses: [...target.clauses],
    rules: {},
  };
  for (const { proposal: p } of verified) {
    const source = sourceFor(target, p.clauseId);
    switch (p.kind) {
      case "roomLimit":
        if (p.proposed.basis) ruleset.rules.roomLimit = { ruleId: `${p.clauseId}.roomRentLimit`, appliesTo: "room", basis: p.proposed.basis, source };
        break;
      case "icuLimit":
        if (p.proposed.basis) ruleset.rules.icuLimit = { ruleId: `${p.clauseId}.icuLimit`, appliesTo: "icu", basis: p.proposed.basis, source };
        break;
      case "proportionateDeduction":
        ruleset.rules.proportionateDeduction = {
          ruleId: `${p.clauseId}.proportionateDeduction`,
          affectedClass: "associatedMedicalExpenses",
          conditions: (p.proposed.conditions ?? []).map((conditionId) => ({ conditionId, description: "The Hospital follows differential billing based on room category.", resolvableBy: "hospital" as const })),
          triggers: p.proposed.triggers ?? ["room"],
          source,
        };
        break;
      case "itemClasses":
        ruleset.rules.itemClasses = { ruleId: `${p.clauseId}.itemClasses`, included: p.proposed.included ?? [], excluded: p.proposed.excluded ?? [], source };
        break;
      case "copay":
        if (p.proposed.percent !== undefined) ruleset.rules.copay = { ruleId: `${p.clauseId}.copay`, percent: p.proposed.percent, source };
        break;
      case "sumInsuredCap":
        ruleset.rules.sumInsuredCap = { ruleId: `${p.clauseId}.sumInsuredCap`, source };
        break;
    }
  }
  return ruleset;
}

/** The prompt for the live adapter. Public clause text only. */
export function buildPrompt(clauses: readonly Clause[]): string {
  const listing = clauses.map((c) => `[${c.id}] (page ${c.page}) ${c.text}`).join("\n\n");
  return [
    "You are reading the PUBLIC wording of an Indian health-insurance policy. Propose candidate rules for a deterministic engine. You decide nothing; a person will confirm or reject each proposal.",
    "",
    "Return ONLY a JSON array. Each element: { id, kind, clauseId, quotedText, rationale, proposed }.",
    'kind is one of "roomLimit", "icuLimit", "proportionateDeduction", "itemClasses", "copay", "sumInsuredCap".',
    "quotedText must be copied VERBATIM from the cited clause, character for character; proposals whose quote is not verbatim are discarded automatically.",
    'proposed carries only what the clause states: for limits { basis: { kind: "percentOfSumInsuredPerDay", percent, capPerDay? } | { kind: "fixedPerDay", amount } } with amounts in integer paise; for proportionateDeduction { conditions: ["hospitalFollowsDifferentialBilling"]?, triggers: ["room","icu"]? }; for itemClasses { included, excluded } using the categories nursing, surgeonFees, anaesthetistFees, consultantFees, operationTheatre, implant, pharmacyConsumables, diagnostics, physiotherapy, hospitalAdmin; for copay { percent }.',
    "Do not infer what the wording does not say. If a clause is ambiguous, say so in the rationale and leave the field out.",
    "",
    "CLAUSES:",
    "",
    listing,
  ].join("\n");
}

const proposalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["roomLimit", "icuLimit", "proportionateDeduction", "itemClasses", "copay", "sumInsuredCap"]),
  clauseId: z.string().min(1),
  quotedText: z.string().min(1),
  rationale: z.string(),
  proposed: z.object({
    basis: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("percentOfSumInsuredPerDay"), percent: z.number().min(0).max(100), capPerDay: z.number().int().min(0).optional() }),
        z.object({ kind: z.literal("fixedPerDay"), amount: z.number().int().min(0) }),
        z.object({ kind: z.literal("scheduleDefined") }),
      ])
      .optional(),
    conditions: z.array(z.literal("hospitalFollowsDifferentialBilling")).optional(),
    triggers: z.array(z.enum(["room", "icu"])).optional(),
    included: z.array(billCategorySchema).optional(),
    excluded: z.array(billCategorySchema).optional(),
    percent: z.number().min(0).max(100).optional(),
  }),
});

export type ParsedProposals = { ok: true; value: RuleProposal[] } | { ok: false; error: string };

/** Parses the model's reply: a JSON array, possibly inside a code fence. Validates every proposal. */
export function parseProposalsResponse(text: string): ParsedProposals {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "The reply was not valid JSON." };
  }
  const parsed = z.array(proposalSchema).safeParse(raw);
  if (!parsed.success) return { ok: false, error: `The reply did not match the proposal shape: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  return { ok: true, value: parsed.data as RuleProposal[] };
}

export const KIND_LABEL: Record<ProposalKind, string> = {
  roomLimit: "Room rent limit",
  icuLimit: "ICU limit",
  proportionateDeduction: "Proportionate deduction",
  itemClasses: "Expenses the deduction touches",
  copay: "Co-payment",
  sumInsuredCap: "Sum insured cap",
};
