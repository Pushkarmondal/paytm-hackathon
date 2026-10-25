# Claim Sach: architecture

Data flow, rules engine, provenance, and privacy boundaries. Companion to `docs/PRD.md`.

## 1. Shape of the system

Claim Sach is a single-page Next.js application whose entire workflow runs in the browser. There is no database, no server-side state, no upload endpoint and no network call in the demo. The rules engine is plain TypeScript with no I/O; the UI is a thin layer over a tested screen model.

```
            ┌─────────────────────────────────────────────┐
  Fixture ─▶│ Ingestion (src/ingestion)                   │
  JSON    ─▶│  JSON → Zod schema → evidence cross-check   │──▶ typed documents, provenance "upload"
  CSV     ─▶│  CSV  → line items in paise, warnings       │
            └─────────────────────────────────────────────┘
                                   │
                                   ▼
            ┌─────────────────────────────────────────────┐
            │ Screen model (src/model)                    │
            │  AppState, reducer, buildInputs(): variant  │
            │  + uploads + edits + confirmations          │
            └─────────────────────────────────────────────┘
                                   │ CaseInputs + Scenario
                                   ▼
            ┌─────────────────────────────────────────────┐
            │ Rules engine (src/engine)                   │
            │  classify → limits → deduction → evaluate   │
            │  → SimulationResult { items, totals,        │
            │    uncertainties, traces, states }          │
            │  compare(A, B) → deltas with cause rules    │
            └─────────────────────────────────────────────┘
                     │                        │
                     ▼                        ▼
       Deterministic explainer        Screens (src/components)
       (src/explain)                  overview · twin · why · uncertainty · review
       [LlmAdapter: interface + stub, off]      trace drawer on every amount
```

Supporting modules: `src/retrieval` (tf-idf clause retrieval), `src/extraction` (regex rule candidates), `src/lib/format-inr` (rupee formatting), `tests/eval` + `scripts/eval.ts` (the evaluation harness).

## 2. Module boundaries

| Module | May import | Must never |
|---|---|---|
| `src/engine` | `src/lib/format-inr` only | perform I/O, read files, call the network, import React or the UI, call a model |
| `src/fixtures` | `src/engine` types | contain real insurer text presented as such |
| `src/ingestion` | `src/engine` types, `zod` | compute money, throw, send data anywhere |
| `src/retrieval`, `src/extraction` | `src/engine` types | decide anything; their output is a candidate for human review |
| `src/explain` | `src/engine` types, `src/lib` | alter a number; the adapter never receives a schedule, bill, name or medical detail |
| `src/model` | `src/engine`, `src/fixtures`, `src/lib` | import React |
| `src/components` | everything above | hold business logic; components call `evaluate`, `compareScenarios` and the model's pure functions |

Enforced by review and by the tests: the engine's tests import nothing from the UI, and the UI has no arithmetic of its own.

## 3. Rules engine

### 3.1 Inputs

`CaseInputs` = one `PolicyRuleset` (clauses with ids, page numbers and full text, plus the rules that cite them), one `PolicySchedule` or `null`, one `HospitalEstimate` (room options, room days, non-room line items, whether differential billing is stated), and `Confirmations` (facts the user confirmed or supplied). A `Scenario` picks a room option and optionally an edited rate.

Each policy is a separate ruleset. The engine hard-codes no insurer and no "universal" policy: without a `proportionateDeduction` rule there is no deduction; without a `roomLimit` rule there is no limit.

### 3.2 Pipeline (`src/engine/evaluate.ts`)

1. **Room rent** = selected rate × room days; **scenario total** = non-room items + room rent.
2. **Classify** each line by the policy's own `itemClasses` definition: included in the deduction, excluded, ICU, room rent, or unknown. The user may classify an unknown line (provenance `userConfirmed`); the user can never override the policy's definition.
3. **Resolve limits** (`limits.ts`): the room and ICU per-day limits from the rule's basis and the schedule's sum insured. Missing schedule → unknown. A figure printed on the schedule that disagrees with the wording → review required. Compute the amount above each limit.
4. **Deduction** (`deduction.ts`): applicability is one of `ruleAbsent`, `undetermined`, `withinEntitlement`, `conditionFailed`, `conditional`, `applies`. The ratio is eligible ÷ actual room rate, exact. Each included item gets `item × (1 − ratio)`; excluded items get a trace that cites the excluding clause; unknown items get no number.
5. **Totals**: calculated deductions (room excess + ICU excess + established item deductions), conditional deductions as a range or `null`, unclassified amount and count kept separate.
6. **Uncertainties**: collected from every step, de-duplicated by code.
7. **Overall state**: `cannotDetermine` (limit unknown), `reviewRequired` (documents contradict), `conditional`, or `calculated`.

`compareScenarios(a, b)` (`compare.ts`) lines up the two results item by item, marks changed rows, names the rule behind each change, and gives money deltas only where both sides are settled.

### 3.3 Money

`Money` is a branded integer number of paise. `Ratio` is a pair of integers reduced by their gcd. `mulRatio` multiplies with BigInt and rounds half up at the paisa, once. There is no floating-point currency arithmetic anywhere in the engine; formatting to rupees happens only in `src/lib/format-inr.ts` and the components.

### 3.4 Result states

| State | Meaning |
|---|---|
| `calculated` | every input established, every condition of the rule met |
| `conditional` | the rule applies if a named yes/no condition holds; shown as a range with both bounds |
| `unknown` | an input is missing or the wording does not classify the item; the amount is absent, never zero |
| `excluded` | the policy's own definition keeps the item out of this rule |
| `requiresInsurerConfirmation` | the wording is silent; only the insurer can settle it (carried by uncertainty reasons) |
| `reviewRequired` | the documents contradict each other |

Ranges exist only where the open question is binary (differential billing: yes or no) and both outcomes are computed. An unclassified item gets no range, because "included", "excluded" and "not payable at all" are three different outcomes the wording does not settle.

## 4. Provenance and traces

Every calculated, conditional or excluded amount carries a `Trace`:

- `ruleId`, `ruleName`
- `inputs[]`: name, typed value (money, days, ratio, percent, text, boolean) and provenance (`fixture`, `upload`, `userConfirmed`, `userEntered`)
- `source`: document id and title, version, page, clause id, quoted text
- `formula` (human-readable) and `operation` (a stable identifier the tests check)
- `output`: state and value or range
- `assumptions[]`: the uncertainty reasons the result still depends on

`validateTrace` (`trace.ts`) rejects a trace whose quoted text is not verbatim in the source documents, whose inputs or formula are empty, or whose output is inconsistent with its state. The acceptance test "every displayed calculated result has a valid trace" runs it over every trace of five scenarios.

Uploaded rulesets go through the same check at ingestion: a rule that misquotes its clause is refused with an `EVIDENCE` error.

## 5. Ingestion

Formats: Claim Sach ruleset JSON, schedule JSON, estimate JSON (all in the engine's shape, amounts in integer paise), and estimate CSV (line items in rupees: `label, category, amount_rupees[, days, rate_per_day_rupees]`). PDF is not supported in this version.

Limits and safety: 5 MB per file; type decided by extension, not by the declared MIME type; JSON parsed then validated with Zod; CSV parsed line by line with per-line error messages; unknown categories mapped to `other` with a warning; every adapter returns a result object and never throws. Files are read with the browser's `File.text()`; nothing is posted anywhere.

What is extracted is shown on the Input review screen with provenance "From your upload" before it is used. Line items from a CSV replace the demo estimate's items while room options and room days stay from the demo, and the screen says so.

## 6. Retrieval and extraction

`src/retrieval`: tf-idf cosine over clause title (weighted ×3) and text, a small synonym table, no model. `src/extraction`: regular expressions that propose a room or ICU limit, a proportionate-deduction rule and its differential-billing condition, the included and excluded categories of the definition clause, and a sum-insured cap. Both produce candidates for a reviewer; neither writes into the ruleset. Their accuracy is measured by the evaluation harness on the synthetic wording only.

## 7. Explanations and the optional LLM adapter

`explainTrace(trace)` produces plain words from the trace's operation, inputs and output. It is what the trace drawer shows under "In plain words".

`LlmAdapter` is an interface with a `nullAdapter` (unavailable) as the only implementation. `explainWith(adapter, trace)` always computes the deterministic text, uses adapter prose only when the adapter is on and answers, and returns both so the UI can label the prose as an explanation. No adapter is wired to any provider in this version; enabling one would need `CLAIM_SACH_LLM_PROVIDER` and a key, and would receive only traces (public wording text and computed numbers), never a schedule, a bill, a name or a medical detail.

## 8. Screen model and UI

`src/model` holds `AppState` (screen, demo variant, planned and comparison rooms, confirmations, edits, uploads, upload errors, open trace) and a pure reducer. `buildInputs(state)` derives engine inputs: the demo documents, altered by the chosen variant, overridden by uploads, then by edits (room days, sum insured) with provenance `userEntered`. `headlineFor`, `groupUncertainties` and `stateLabel` turn results into what the screens show. All of this is unit-tested without a DOM.

Components are client components. `ClaimSachApp` owns the reducer, memoises `evaluate` for both rooms and `compareScenarios`, and renders the active screen and the trace drawer. No component holds business logic.

## 9. Privacy boundaries

- Nothing the user enters or uploads leaves the browser. There is no upload route, no analytics, no storage; a reload or "Reset to demo" discards everything.
- The demo's insured, hospital, procedure and amounts are synthetic and say so.
- No raw document is logged. The only console output is the framework's own.
- No environment variable is required. `.env.example` documents the optional adapter variables; `.env*` is git-ignored.
- The policy fixture is labelled synthetic in its metadata, in the header badge, on the overview and in every trace's document title.

## 10. Testing and evaluation

- `npm test`: Vitest. Engine (money, classification, limits, evaluation, comparison, traces), screen model, ingestion, retrieval, extraction, explainer, formatting. The brief's 13 acceptance cases are in `tests/unit/evaluate.test.ts`, `limits.test.ts`, `classify.test.ts`, `trace.test.ts` and `ingestion.test.ts`.
- `npm run eval`: the harness in `scripts/eval.ts` over `tests/eval/fixtures.ts`; four measures reported k of n; results committed in `docs/EVALUATION-RESULTS.md` and checked for staleness in CI.
- `npm run lint`, `npm run typecheck`, `npm run build`: on every pull request via GitHub Actions.

## 11. Versions

Every result embeds `engineVersion` (from `src/engine/types.ts`) and `fixtureVersion` (from the ruleset). Changing a clause's text or a rule bumps the fixture version.

## 12. Known limitations

- One wording in the box, and it is synthetic. Real wordings must be encoded as rulesets and verified by a person.
- The engine models the room rent limit, the ICU limit, the proportionate deduction and the policy's item classification. Co-payment, other sub-limits, exclusions, waiting periods, non-payable items and pre/post-hospitalisation are listed as not modelled, not estimated.
- No PDF ingestion. No persistence. No multi-policy coordination.

## 13. Additions of 24 October 2026 (evening)

### 13.1 Engine extensions

- **Capped percent limits** (`percentOfSumInsuredPerDay` with `capPerDay`): the eligible rate is the lower of the percentage and the cap; the trace shows both.
- **Room-or-ICU triggered proportion** (`triggers` on the deduction rule): the proportion can be driven by the ICU rate exceeding its limit. When room and ICU both exceed in the same ratio, that ratio applies; in different ratios the engine refuses to choose and gives a range (`RATIO_AMBIGUOUS_ROOM_AND_ICU`, requires insurer confirmation).
- **Co-payment** (`copay` rule): a percentage of the admissible amount. A single figure only when every other amount is settled; otherwise a range over the jointly possible outcomes of the open questions (see below).
- **Joint outcomes** (25 October 2026): the deduction reports every jointly possible outcome of its open questions (differential billing, the room or ICU ratio when they differ, each caveat) as a `DeductionWorld` with the deduction per item; `evaluate` crosses those with the admissibility of each unclassified item, computes the co-payment inside each outcome, and bounds `totals.conditionalDeductions` and `copay.range` by the smallest and largest complete totals. The earlier version added component bounds, which paired a maximum deduction with a co-payment computed as if it had not happened; the range basis now names the outcome behind each bound.
- **Caveats and notices** on a ruleset: a caveat makes the affected items' deductions conditional on insurer confirmation (used for the 2019-20 wording that predates IRDAI's 2020 norms); a notice is an uncertainty with no amount (used for nursing sitting inside the room-rent limit).
- `itemClasses.notes` lets a fixture say why a category is deliberately left unclassified; the reason reaches the uncertainty panel.

### 13.2 The real wording

`src/fixtures/arogya-sanjeevani-nia`: ten clauses of The New India Assurance Co. Ltd.'s Arogya Sanjeevani wording (UIN NIAHLIP20165V011920), extracted with pdftotext from the PDF hosted on irdai.gov.in, line breaks joined and repeated spaces collapsed, nothing else changed. `VerificationRecord` in the metadata carries the URL, SHA-256, fetch date, page count, extraction method, the list of encoded clauses and the partial-encoding note; the UI shows it on Input review and in the evidence pack. The schedule used with it is synthetic and says so.

### 13.3 The AI seam (`src/ai`)

`RuleProposal` is a candidate rule with a clause id and a quoted excerpt. `verifyProposals` checks the excerpt verbatim (whitespace-normalised) against the clause text. `buildRulesetFromProposals` turns confirmed, verified proposals into a `PolicyRuleset` whose every `SourceRef` quotes the full clause, so the engine's traces and the ingestion evidence check both pass; it throws on an unverified proposal. `buildPrompt` carries clause text only; `parseProposalsResponse` validates the model's reply with Zod. The route `POST /api/propose-rules` returns 503 unless `CLAIM_SACH_LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set; it is implemented but was not exercised in this build. The demo uses cached proposals (`llm-proposals.ts`) whose provenance is printed on screen. `proposalFieldChecks` compares a proposal with the human-reviewed ruleset, for the harness and the builder's agreement badges.

### 13.4 Screen-model additions

`buildLadder` evaluates every room option and marks the highest room within the room-rent limit. `questionSheet` turns the uncertainties into questions for the hospital, the insurer and the user, each with its clause and the rupees at stake; `questionSheetText` renders them for copy, print or save. `evidencePackMarkdown` and `evidencePackJson` export the full result with every trace, the verification record and the disclaimer. The reducer gained `setPolicy`, `decideProposal`, `applyProposals` and `clearDecisions`; applying proposals installs the built ruleset as an upload, so every screen recomputes on what the user confirmed.
