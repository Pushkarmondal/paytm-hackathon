/**
 * Evaluation harness. Four separate measures, each k of n over a
 * human-reviewable fixture set. Prints a report and writes
 * docs/EVALUATION-RESULTS.md. Fails (exit 1) only if the harness itself
 * cannot run; a low score is reported, not hidden.
 */

import { writeFileSync } from "node:fs";
import { evaluate } from "@/engine/evaluate";
import { ENGINE_VERSION } from "@/engine/types";
import { extractRules } from "@/extraction";
import { verifyProposals, type RuleProposal } from "@/ai";
import { proposalFieldChecks } from "@/ai/compare";
import type { PolicyRuleset } from "@/engine/types";
import { NIA_CLAUSES, NIA_FIXTURE_VERSION, NIA_RULESET } from "@/fixtures/arogya-sanjeevani-nia";
import { NIA_PROPOSALS, NIA_PROPOSALS_PROVENANCE } from "@/fixtures/arogya-sanjeevani-nia/llm-proposals";
import { DEMO_CLAUSES, DEMO_FIXTURE_VERSION } from "@/fixtures/demo-policy";
import { retrieveClauses } from "@/retrieval";
import type { Clause } from "@/engine/types";
import { CALCULATION_CASES, EXTRACTION_FIELDS, FIXTURE_REVIEW, REFUSAL_CASES, RETRIEVAL_CASES, type CalculationCase, type RefusalCase } from "../tests/eval/fixtures";
import { CALCULATION_CASES_NIA, EXTRACTION_FIELDS_NIA, REFUSAL_CASES_NIA, RETRIEVAL_CASES_NIA } from "../tests/eval/fixtures-nia";

interface Dataset {
  label: string;
  clauses: readonly Clause[];
  retrieval: { question: string; expected: string }[];
  extraction: { field: string; expected: unknown; actual: (e: ReturnType<typeof extractRules>) => unknown }[];
  calculation: CalculationCase[];
  refusal: RefusalCase[];
  proposals?: { items: RuleProposal[]; reviewed: PolicyRuleset };
}

const DATASETS: Dataset[] = [
  { label: "synthetic demo wording (5 clauses)", clauses: DEMO_CLAUSES, retrieval: RETRIEVAL_CASES, extraction: EXTRACTION_FIELDS, calculation: CALCULATION_CASES, refusal: REFUSAL_CASES },
  { label: "Arogya Sanjeevani, New India (10 encoded clauses of a real wording)", clauses: NIA_CLAUSES, retrieval: RETRIEVAL_CASES_NIA, extraction: EXTRACTION_FIELDS_NIA, calculation: CALCULATION_CASES_NIA, refusal: REFUSAL_CASES_NIA, proposals: { items: NIA_PROPOSALS, reviewed: NIA_RULESET } },
];

interface Measure {
  name: string;
  passed: number;
  total: number;
  dataset: string;
  failures: string[];
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function retrieval(d: Dataset): Measure {
  const failures: string[] = [];
  for (const c of d.retrieval) {
    const top = retrieveClauses(c.question, d.clauses, 1)[0]?.clauseId ?? "(none)";
    if (top !== c.expected) failures.push(`"${c.question}" → got ${top}, expected ${c.expected}`);
  }
  return { name: "Clause retrieval accuracy (top-1)", passed: d.retrieval.length - failures.length, total: d.retrieval.length, dataset: `${d.retrieval.length} questions over the ${d.label}`, failures };
}

function extraction(d: Dataset): Measure {
  const extracted = extractRules(d.clauses);
  const failures: string[] = [];
  for (const f of d.extraction) {
    const actual = f.actual(extracted);
    if (!same(actual, f.expected)) failures.push(`${f.field}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(f.expected)}`);
  }
  return { name: "Rule extraction accuracy (field-level)", passed: d.extraction.length - failures.length, total: d.extraction.length, dataset: `${d.extraction.length} rule fields of the ${d.label}, against the reviewed ruleset`, failures };
}

function calculation(d: Dataset): Measure {
  const failures: string[] = [];
  let fields = 0;
  let fieldFailures = 0;
  for (const c of d.calculation) {
    const r = evaluate(c.inputs, c.scenario);
    const bad: string[] = [];
    for (const e of c.expect) {
      fields++;
      const actual = e.read(r);
      if (actual !== e.expected) {
        fieldFailures++;
        bad.push(`${e.field}: got ${String(actual)}, expected ${String(e.expected)}`);
      }
    }
    if (bad.length) failures.push(`${c.name}: ${bad.join("; ")}`);
  }
  return {
    name: "Calculation correctness (exact match in paise)",
    passed: d.calculation.length - failures.length,
    total: d.calculation.length,
    dataset: `${d.calculation.length} scenarios, ${fields} expected amounts (${fields - fieldFailures} matched), hand-computed, on the ${d.label}`,
    failures,
  };
}

function refusal(d: Dataset): Measure {
  const failures: string[] = [];
  for (const c of d.refusal) {
    const r = evaluate(c.inputs, c.scenario);
    const bad: string[] = [];
    if (r.overallState !== c.expectedOverall) bad.push(`overall ${r.overallState}, expected ${c.expectedOverall}`);
    for (const m of c.mustBeNull) {
      const v = m.read(r);
      if (v !== null && v !== undefined) bad.push(`${m.field} is ${JSON.stringify(v)}, expected no number`);
    }
    const codes = r.uncertainties.map((u) => u.code);
    for (const code of c.expectedCodes) if (!codes.includes(code)) bad.push(`missing uncertainty ${code}`);
    if (bad.length) failures.push(`${c.name}: ${bad.join("; ")}`);
  }
  return { name: "Uncertainty and refusal quality", passed: d.refusal.length - failures.length, total: d.refusal.length, dataset: `${d.refusal.length} cases with an expected state, values that must stay unknown, and expected reasons, on the ${d.label}`, failures };
}

function proposalMeasures(d: Dataset): Measure[] {
  if (!d.proposals) return [];
  const verified = verifyProposals(d.proposals.items, d.clauses);
  const quoteFailures = verified.filter((v) => !v.verification.quoteFound).map((v) => `${v.proposal.id}: ${v.verification.problems.join("; ")}`);
  const checks = d.proposals.items.flatMap((p) => proposalFieldChecks(p, d.proposals!.reviewed).map((c) => ({ ...c, id: p.id })));
  const fieldFailures = checks.filter((c) => !c.same).map((c) => `${c.id} ${c.field}: proposed ${JSON.stringify(c.actual)}, reviewed ${JSON.stringify(c.expected)}`);
  return [
    { name: "LLM proposals: quotes verified verbatim (cached)", passed: verified.length - quoteFailures.length, total: verified.length, dataset: `${verified.length} cached proposals (${NIA_PROPOSALS_PROVENANCE.model}; not an API run)`, failures: quoteFailures },
    { name: "LLM proposals: field agreement with the reviewed ruleset (cached)", passed: checks.length - fieldFailures.length, total: checks.length, dataset: `${checks.length} proposed fields against the human-reviewed ruleset`, failures: fieldFailures },
  ];
}

const lines: string[] = [
  "# Evaluation results",
  "",
  "Generated by `npm run eval`. Do not edit by hand; CI fails if this file is stale.",
  "",
  `Engine ${ENGINE_VERSION}; demo fixture ${DEMO_FIXTURE_VERSION}; Arogya Sanjeevani fixture ${NIA_FIXTURE_VERSION}. Fixtures authored ${FIXTURE_REVIEW.authoredOn} by ${FIXTURE_REVIEW.authoredBy}. Human review: ${FIXTURE_REVIEW.humanReview}.`,
  "",
  "Two datasets: the synthetic demo wording, and the ten encoded clauses of one real wording (Arogya Sanjeevani, The New India Assurance Co. Ltd., UIN NIAHLIP20165V011920, hosted by IRDAI). The real-wording numbers cover only those ten clauses, with a synthetic schedule and estimate; they say nothing about the rest of that policy or about other insurers. The LLM proposal measures use CACHED proposals written by the build session offline, not an API run; the live adapter was not exercised.",
  "",
];
const allFailures: string[] = [];
for (const d of DATASETS) {
  const measures = [retrieval(d), extraction(d), calculation(d), refusal(d), ...proposalMeasures(d)];
  lines.push(`## ${d.label}`, "", "| Measure | Result | Dataset |", "|---|---|---|", ...measures.map((m) => `| ${m.name} | **${m.passed} of ${m.total}** | ${m.dataset} |`), "");
  allFailures.push(...measures.flatMap((m) => m.failures.map((f) => `- ${d.label}, ${m.name}: ${f}`)));
}
lines.push("## Failures", "", ...(allFailures.length ? allFailures : ["None."]), "");

const report = lines.join("\n");
writeFileSync("docs/EVALUATION-RESULTS.md", report);
console.log(report);
