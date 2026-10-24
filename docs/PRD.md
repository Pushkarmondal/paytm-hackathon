# Claim Sach: Product Requirements Document

| | |
|---|---|
| Status | Build-ready draft v1.1, pending Pushkar's approval before any code is written (v1.0 written and revised to v1.1 the same evening) |
| Date | Saturday 24 October 2026 |
| Owner | Pushkar Mondal |
| Event | Paytm Build for India AI Hackathon, Bengaluru, Saturday 31 October 2026 |
| Deck deadline | Hard stop: 27 October 2026, 00:00:00 IST, the end of Monday 26 October (devSemble, verified in IST; Appendix C). Luma prints 11:59 PM IST, 27 Oct; the earlier wins. **Internal submission target: Monday 26 October, 17:30 IST** |
| Folder | `~/paytm-hackathon` (this project only; nothing shared with any other project) |

How to read this document: a statement marked **(verified)** was read from a primary source named in Appendix C. A statement marked **(assumption)** is a working assumption and is labelled wherever it is used. Nothing else in this document is a claim about the world; it is a decision about what we will build. No metric, saving, accuracy figure, testimonial or Paytm integration appears here as a fact, because none exists yet.

Where the execution brief and this PRD differ, the brief wins; any such difference found before or during the build is recorded in Appendix D.

---

## 1. Product summary

| | |
|---|---|
| Product | **Claim Sach** |
| Signature feature | **Coverage Twin** |
| Track | Track 2, AI-Powered Financial Journeys |
| Tagline | Know what your policy might leave you paying before admission. |

**Description.** Claim Sach is a policy-to-bill engine. It takes the terms of one health-insurance policy (wording plus schedule), turns the terms that matter for a hospital stay into structured, versioned rules, applies those rules to an itemised hospital estimate for a planned admission, and shows the user an itemised view of the potential deductions covered by this simulation: the amounts those specific policy mechanisms could leave the user paying. It does not estimate the user's total out-of-pocket cost, and it lists on screen the costs and policy terms it does not model. The user can change the scenario, above all the room category and room rate, and see immediately how the potential deductions and the scenario total change, which clause caused the change, and what the engine cannot yet determine. Every amount on screen carries a trace back to the rule, the inputs, the formula and the quoted source clause. Anything the available documents do not settle is shown as unknown, conditional or "requires insurer confirmation", never as a number.

**Positioning.** Claim Sach is an evidence-backed, interactive health-insurance coverage simulator. It is not a chatbot that reads PDFs, and it is not a policy explainer. The distinctive workflow is:

> Policy documents → structured rules → scenario simulation → itemised potential deductions → source evidence → explicit uncertainty.

The simulator does not guarantee, predict or replace an insurer's final payment decision. That sentence appears on screen (see §9).

---

## 2. Target user and the problem

**Primary user.** A person in India who holds an individual or family-floater health policy, has a hospital estimate for a planned admission in hand, and must choose a room category within days. In practice the user is often the family member who manages the policy and talks to the hospital's insurance desk.

**Secondary user.** The claim-assistance agent at a broker who takes that person's call. Paytm Insurance Broking already offers claim assistance by phone **(verified, planning session: see Appendix C)**; the simulator is a tool such an agent could use while on the call. No integration is claimed.

**The problem.** Health-insurance buyers usually discover room-rent limits, proportionate deductions, co-payments, sub-limits, exclusions and waiting periods at the moment they need care. The room-rent clause is the central mechanism, for three reasons:

1. **It is not about the room.** When the chosen room's rent exceeds the policy's eligible limit, many policies pay the "associated medical expenses" (surgeon, anaesthetist, consultants, nursing, operation theatre) only in the proportion that the eligible rent bears to the actual rent. A ₹2,500-a-day gap in room rent can become a five-figure reduction in what is paid for the surgery itself. In the planned demo fixture (Appendix A), choosing a single private room instead of a twin-sharing room moves the potential deductions from the room choice from ₹0 to ₹48,000 on a ₹3,23,500 estimate (the scenario total with the single private room), and ₹38,000 of that comes from items that are not the room.
2. **Which items are affected depends on the policy's own definition.** IRDAI's 2020 norms required insurers that use proportionate deductions to define "associate medical expenses" in the policy and barred pharmacy and consumables, implants and medical devices, and diagnostics from that definition, barred the deduction for ICU charges, and barred it where the hospital does not follow differential billing by room category **(verified: IRDAI circular Ref IRDAI/HLT/REG/CIR/151/06/2020, 11 June 2020, read from irdai.gov.in; Appendix B)**. That circular was superseded on 29 May 2024 by IRDAI's Master Circular on Health Insurance Business, which lists it in its Annexure-6 **(verified: Appendix B)**. Whether the same norms continue under the 2024 regulations and circular is **not verified** by this document. So the only honest way to compute a deduction is from the specific policy's wording, item by item.
3. **It depends on facts outside the policy.** Whether the hospital uses differential billing, and whether the eligible room category was available, change the answer. A tool that ignores them overstates its own certainty.

**Differentiation, as a hypothesis to validate.** Our working hypothesis is that general explainers and comparison sites explain the room-rent rule with a made-up example; do not apply the user's own policy wording to the user's own estimate; do not say which line items of this bill are affected and which are protected; do not show the clause beside the number; do not say what they could not determine; and that comparison sites exist to rank policies for purchase, a non-goal here. This hypothesis has not been validated by a documented competitor review. Until one exists (a one-hour review of at least six explainers, aggregators and insurer tools, written up in `docs/COMPETITORS.md`, scheduled for Sunday 25 October, §12.2), neither this document nor the deck asserts that no competitor offers interactive, policy-specific deduction calculation. What Claim Sach does is stated on its own terms: the specific, item-level, clause-cited, uncertainty-marked version of the calculation, interactively.

---

## 3. Frozen MVP scope

One excellent end-to-end workflow. Nothing below is optional, and nothing outside it is in the MVP.

### 3.1 Inputs

The user specifies or verifies:

1. **Policy wording and its version** (in the MVP: the synthetic demo wording, v1.0, loaded at open; or a Claim Sach ruleset JSON file).
2. **Policy schedule and applicable coverage details** (in the MVP: the demo schedule `DEMO-SCH-0001`; or a schedule JSON).
3. **Sum insured and relevant eligibility information** (from the schedule; editable on the Input review screen, with provenance switching to "user-entered").
4. **Hospital estimate with itemised charges** (in the MVP: the demo estimate; or a CSV/JSON estimate upload).
5. **Planned room category and room rate** (a selector with the hospital's room options; rate editable).
6. **Any additional information the applicable rules require** (in the MVP: whether the hospital follows differential billing by room category; whether the eligible room category was available; the classification of any bill item the wording does not classify).

A functional sample scenario loads the moment the app opens. No upload, sign-in, or API key is needed to see the whole product work.

**Upload formats supported in the MVP:** Claim Sach ruleset JSON (schema-validated), estimate as CSV or JSON. Every extracted value is shown on the Input review screen and must be confirmed before it is used. PDF text extraction with candidate-clause detection is a stretch item (§3.6); if it ships, candidates are never applied without review. Anything else is rejected with a clear message (§9).

### 3.2 The six prioritised calculations

In priority order. Each produces a result state from §7.4.

| # | Calculation | Output |
|---|---|---|
| 1 | **Policy-specific room eligibility and room-rent limit**, plus the ICU daily limit where the policy states one (same comparison primitive) | Eligible rate, chosen rate, days, excess per day, excess total; state *calculated* when the schedule and wording agree |
| 2 | **Proportionate deduction**, applied only when the wording contains the rule and its stated conditions are met | Ratio (eligible ÷ actual), the deduction per affected item, total; state *calculated* when every condition is established, *conditional* when a condition (for example, differential billing) is not yet established |
| 3 | **Identification of potentially affected bill items**, from the policy's own definition of associated medical expenses and its exclusions | Each item classified: included in deduction, excluded from deduction, or unknown |
| 4 | **Range or unresolved status** when a classification or a rule condition cannot be established | A range only when both bounds follow from the finite outcomes of the unresolved condition; otherwise an unresolved status with the reason |
| 5 | **Interactive comparison of at least two room choices** on the same policy and estimate | Side-by-side itemised potential deductions, with the room rent and the scenario total recalculated for each room (selected daily rate × days; non-room items fixed), the delta per item, the cause of each delta |
| 6 | **A complete breakdown of how each amount was obtained** | The trace of §7.1 for every displayed amount |

Rules the engine must obey: no single ratio is applied to the whole bill; eligibility and exclusions are encoded per policy; ICU charges and excluded expense classes are handled explicitly where the policy requires; each policy is a separate ruleset; there is no "universal Indian health policy" hard-coded anywhere.

### 3.3 The five required screens

1. **Scenario overview**: selected policy (name, version, synthetic/verified label), room choice, hospital estimate summary.
2. **Coverage Twin**: two scenarios side by side with the itemised financial breakdown.
3. **Why this changed**: source clause, formula, input values, output, for every delta.
4. **What remains uncertain**: missing documents, ambiguous conditions, required verification.
5. **Input review**: the extracted or seeded policy and estimate fields, each confirmable or correctable.

### 3.4 The signature feature: Coverage Twin

A judge can, without help:

1. Open an example policy and hospital estimate (it is already open).
2. See the current room choice, the applicable policy limit, and the affected bill items.
3. Change the room category or room rate.
4. Watch the itemised breakdown of potential deductions, the room rent and the scenario total update immediately.
5. Click any amount to inspect its exact source clause, inputs, formula and output.
6. Open the uncertainty panel and read what could not be established.

The Twin distinguishes the five states of §7.4 visually and in words.

### 3.5 The wow moment: "Change your room. See the difference."

Scenario A (Twin-sharing, ₹4,500/day, within the ₹5,000/day limit) beside Scenario B (Single private, ₹7,500/day). The same policy, the same estimate. Switching the room changes the room rent from ₹18,000 to ₹30,000 (rate × 4 days), the scenario total from ₹3,11,500 to ₹3,23,500 (non-room items stay at ₹2,93,500), and the potential deductions from the room choice from ₹0 to ₹48,000; the panel beside it shows why: clause C1 (room-rent limit, ₹10,000 of excess over 4 days) and clause C3 (proportionate deduction at ratio 5,000 ÷ 7,500 on the ₹1,14,000 of associated medical expenses, ₹38,000). The transition is a clear, fast state change with the changed rows highlighted; nothing decorative. Numbers are from the planned fixture in Appendix A and will be confirmed by the engine's tests before they appear in any deck. If the fixture's wording did not support a change, we would pick a scenario that does; we do not manufacture one.

### 3.6 Stretch items (only after §8 acceptance tests pass)

- Co-payment rules.
- Disease- or procedure-specific sub-limits beyond the room and ICU limits.
- PDF text extraction (client-side) with candidate-clause detection for review.
- Optional LLM explanation adapter (§6.6), off by default.

---

## 4. Explicit non-goals

Verbatim from the execution brief. Do not implement:

- Claim submission or automatic insurer communication.
- Final payout guarantees.
- Insurance purchase recommendations.
- Cross-policy ranking.
- A full claims-document management system.
- Real Paytm or insurer integration without authorized API access.
- A generic chat interface as the main product.
- Fake user testimonials, savings, accuracy figures, or adoption statistics.

Also out of scope for the MVP, by decision rather than by the brief: claim-preparation checklists (insurer-specific), pre- and post-hospitalisation expenses, waiting-period evaluation, and multi-policy or top-up coordination.

---

## 5. Success criteria

### 5.1 The deck (Monday 26 October 2026)

- Uploaded on devSemble by Pushkar by **17:30 IST on Monday 26 October** (internal target), against the verified hard stop of 00:00:00 IST on 27 October, the end of Monday (Appendix C). The target leaves six and a half hours of buffer and does not depend on how any viewer's timezone renders the listing.
- Contains the seven required sections: title slide, problem statement, proposed solution, technology/tech stack, USP, impact & benefits, business model.
- At least one real screenshot of the Coverage Twin running on the fixture (so the engine and one screen must exist by Monday midday).
- Zero unverified claims: every fact traceable to Appendix C; every business-case statement phrased as a hypothesis with a test.
- Names nothing that does not exist (no "Periscope", no live Bima Sugam, no Paytm integration).
- Makes no comparative claim ("nobody else does this") on the USP slide beyond what the documented competitor review supports (§2, §12.2).
- Labels every figure as potential deductions covered by the simulation, never as total out-of-pocket cost.

### 5.2 The demo (Saturday 31 October 2026, 18:00 slot)

- The three-minute script in §11 runs end to end from `localhost` with Wi-Fi off, on Pushkar's laptop, in demo mode.
- Shows both the valid calculation and the ambiguous case the engine refuses to overstate.
- Every headline figure is labelled "potential deductions covered by this simulation"; no figure is ever labelled as total out-of-pocket cost (the phrase appears only in the sub-line that denies it); the list of unmodelled terms is one click away.
- Every number a judge clicks opens a trace; the uncertainty panel is one click away at all times.
- Reset-to-demo restores the seeded state in one click.
- Rehearsed at least three full times before Saturday, once by someone who did not build it (Pushkar, if the build is solo).
- No console errors, no spinners waiting on the network, no placeholder text.

### 5.3 Engineering

All of the brief's acceptance tests exist as unit tests and pass:

1. Selected room is within the applicable room entitlement.
2. Selected room exceeds the stated entitlement.
3. Proportionate deduction is applied only when the relevant policy rule is explicitly applicable.
4. Associated bill items are classified according to the selected policy rules.
5. Explicitly excluded categories are not incorrectly included in a deduction.
6. Unknown item classification produces uncertainty rather than a fabricated calculation.
7. Missing policy schedule prevents an unsupported definitive result.
8. Contradictory policy terms produce a review-required state.
9. Changing the room choice recalculates all dependent outputs.
10. Every displayed calculated result has a valid trace.
11. Amounts are calculated with currency-safe arithmetic.
12. A synthetic policy is clearly distinguishable from a verified insurer-issued policy.
13. Malformed uploads and unsupported file types fail safely.

Plus:

- Lint, typecheck, tests and build pass locally and in CI on every pull request.
- The evaluation harness (§5.4) runs with one command and prints actual results from a human-reviewed fixture set; the UI shows no accuracy figure that did not come from it.
- The core workflow runs with no environment variables set.
- The scenario total is a dependent output of the room choice (acceptance test 9): it equals the fixed non-room items (₹2,93,500 in the fixture) plus room rent at the selected rate × days, asserted for all three rooms (₹3,11,500, ₹3,23,500, ₹3,41,500).
- `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`, `docs/EVALUATION.md` and the README exist and match the code.

### 5.4 The evaluation harness: four separate measures

| Measure | Question it answers | Fixture | Metric |
|---|---|---|---|
| Clause retrieval accuracy | Given a question such as "which clause sets the room-rent limit?", does the retriever return the right clause? | Labelled (question → clause id) pairs over the demo wording | Top-1 exact match, reported as k of n |
| Rule extraction accuracy | From a clause's text, does the extractor produce the right structured rule (type, value, basis, conditions)? | Human-reviewed structured rules per clause | Field-level exact match, k of n fields |
| Calculation correctness | Does the engine produce the hand-computed expected amounts for each scenario? | Scenarios with expected outputs computed by hand and reviewed | Exact match in paise, k of n scenarios |
| Uncertainty / refusal quality | For missing, contradictory or unclassified inputs, does the engine return the expected state and no number? | Scenarios labelled with the expected state | State match, k of n; any numeric output on an unresolvable case is a failure |

The fixture set will be small and written by hand (tens of cases, not thousands). The report states the dataset size, the date it was reviewed, and who reviewed it. If a measure cannot be run (for example, retrieval with no retriever implemented), the report says "not run", not a number.

---

## 6. Tech stack and architecture

### 6.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict` on, front and back | One language end to end; the engine's types are the product's contract |
| Frontend | Next.js (App Router) with React, scaffolded by `create-next-app` at whatever current stable version it installs; Tailwind CSS | What the brief asks for; fast to ship a credible UI; static-friendly |
| Backend | Next.js route handlers, used only for the optional LLM adapter. The core workflow is entirely client-side and needs no server round trip | Keeps the demo offline-capable and keeps user documents in the browser |
| ORM | **None.** There is no database to map | |
| Database | **None.** Every state is per-session and in memory; the demo fixture is a versioned file in the repository; uploads are parsed in the browser and never stored. A database would add setup, cost, a privacy surface and nothing the product needs this week | |
| Validation | Zod schemas for every ruleset, schedule and estimate input; the same schemas validate the fixture at test time | One place where input shape is defined |
| Money | Integer paise in a branded `Money` type; ratios as integer numerator/denominator; one documented rounding (half up, at the paisa, once per item). No floating-point currency maths, no dependency | Deterministic, exact for the rational arithmetic this product needs |
| Tests | Vitest for the engine, ingestion and formatting; React Testing Library only where a screen's behaviour needs it | Fast, TypeScript-native |
| Lint / types | ESLint (Next's config), `tsc --noEmit` | Standard |
| CI | GitHub Actions on pull requests: `npm ci`, lint, typecheck, test, build, eval harness | The brief's "run lint, typecheck, build, tests before any push" |
| Package manager | npm, Node LTS pinned in `.nvmrc` and `engines` | Fewest moving parts |
| Deployment | Vercel free (Hobby) tier for a shareable link, **and** the demo runs fully offline from `localhost` with `npm run dev` or `npm run build && npm start` | ₹0; the live demo never depends on the network |
| Repository | A new repository on Pushkar's personal GitHub account, created only when he says so; feature branches and pull requests only; never a push to `main` | His rule |

### 6.2 Data flow

```
                      ┌──────────────────────────────┐
  Fixture (repo)  ───▶│  Ingestion adapters          │
  Ruleset JSON    ───▶│  parse → validate (Zod) →    │──▶ ReviewModel (every value + provenance)
  Estimate CSV/JSON ─▶│  candidate values            │          │
  [PDF text, stretch] │  (client-side only)          │          ▼
                      └──────────────────────────────┘   Input review screen
                                                          (user confirms / corrects)
                                                                  │
                                                                  ▼
                 ┌──────────────────────────────────────────────────────────────┐
                 │  Rules engine (pure TypeScript, no I/O, no LLM)               │
                 │  PolicyRuleset + Schedule + Estimate + Scenario               │
                 │   → classify items → evaluate limits → evaluate deduction    │
                 │   → SimulationResult { items[], totals, state, traces[],     │
                 │                      uncertainties[] }                      │
                 └──────────────────────────────────────────────────────────────┘
                                   │                       │
                                   ▼                       ▼
                        Scenario comparison        Deterministic explainer
                        (A vs B → deltas with      (trace → plain sentences)
                         causes)                            │ optional, env-flagged
                                   │                        ▼
                                   │             LLM adapter (public wording +
                                   │             structured results only; never
                                   │             personal data; never authority)
                                   ▼
                 Screens: Overview · Coverage Twin · Why this changed ·
                          What remains uncertain · Input review
```

The engine never reads a file, calls a network, or imports from the UI. The ingestion adapters never compute money. The LLM adapter can only receive text that is already public (the policy wording) or already computed (a structured result), and its output is labelled as explanation, never as a result.

### 6.3 Typed representations

The engine's public types, all in `src/engine/types.ts`:

- `PolicyMetadata`: id, name, issuer (`{ kind: 'synthetic' } | { kind: 'insurer', name, uin, source }`), wordingVersion, effectiveDate, sourceDocument.
- `PolicySchedule`: scheduleId, sumInsured (`Money`), policyPeriod, insuredLabel (synthetic in the demo), roomLimitOverride (optional, with provenance), fields[] with provenance each.
- `RoomEligibilityRule`: basis (`'percentOfSumInsuredPerDay' | 'fixedPerDay' | 'category'`), value, categoryList (optional), appliesTo (`'room' | 'icu'`), sourceRef.
- `ProportionateDeductionRule`: present (boolean), conditions[] (`Condition`), affectedClass (`'associatedMedicalExpenses'`), sourceRef.
- `Condition`: id, description, status (`'established' | 'notEstablished' | 'contradicted'`), evidence (sourceRef or user confirmation), required.
- `ItemClassification`: `'includedInDeduction' | 'excludedFromDeduction' | 'unknown'`, with the clause that decided it or the reason it is unknown.
- `SourceRef`: documentId, documentTitle, version, page, clauseId, quotedText, provenance (`'fixture' | 'upload' | 'userConfirmed'`).
- `CalculationInput` / `CalculationOutput`: named values with units, each with provenance.
- `UncertaintyReason`: code, humanText, affectedItems[], whatWouldResolveIt, resolvable (`'byUser' | 'byHospital' | 'byInsurer' | 'no'`).
- `Trace`: ruleId, inputs, sourceRef, formula (a string the UI renders, and a deterministic operation id the tests check), output, assumptions[].
- `ResultState`: the five states of §7.4.
- `Money` (integer paise, branded), `Ratio` (`{ num, den }`), `Range` (`{ low: Money, high: Money, basis }`).
- `EngineVersion`, `FixtureVersion`: semantic version strings embedded in every result.

### 6.4 Module layout

```
src/
  engine/        money.ts, types.ts, classify.ts, limits.ts, deduction.ts,
                 evaluate.ts, compare.ts, trace.ts        (pure; 100% unit-tested)
  fixtures/      demo-policy/ (wording clauses with ids and text, schedule,
                 schedule-missing, schedule-contradictory), demo-estimate/,
                 scenarios.ts                              (versioned)
  ingestion/     ruleset-json.ts, estimate-csv.ts, estimate-json.ts,
                 review-model.ts, [pdf-text.ts, stretch]  (client-side)
  explain/       deterministic.ts, llm-adapter.ts (interface + stub)
  app/           Next.js routes and layouts
  components/    one folder per screen; presentation only
  lib/           format-inr.ts, ids.ts
tests/           unit/ (engine, ingestion, format), eval/ (harness, fixtures, report)
docs/            PRD.md, ARCHITECTURE.md, DEMO_SCRIPT.md, EVALUATION.md
```

### 6.5 Commands

| Command | Does |
|---|---|
| `npm run dev` | The single documented development command; opens the demo at `http://localhost:3000` |
| `npm run build && npm start` | Production build, also offline |
| `npm run lint`, `npm run typecheck`, `npm test` | What CI runs |
| `npm run eval` | The evaluation harness; writes `docs/EVALUATION.md`'s results block |

### 6.6 The optional LLM adapter

Decision D2 (§16). Order of work: the deterministic engine and the core workflow come first, with no API key and a stub adapter whose deterministic fallback is always available. Only once §5.3 is met may an optional LLM adapter be wired, behind an environment variable and a key, for one job: extracting candidate clauses from a public policy wording. Candidates land on the Input review screen as unconfirmed values and become executable rules only after a human confirms them. A second, lower-priority job is rephrasing an already computed, structured result into prose, labelled as explanation. The adapter never determines or alters a financial calculation, and it never receives a policy schedule, a hospital bill, a name, or any medical detail. If the key is absent or a call fails, the UI shows the deterministic path and a one-line note; the demo runs offline and deterministically either way. This is the product's visible AI capability: AI-assisted extraction around a tested deterministic engine, not an LLM posing as an insurance calculator. Model choice, if it is ever enabled: a current Claude model via the Anthropic API; the exact model id and price are read from the provider's page at the time, not quoted here.

---

## 7. Provenance and uncertainty model

### 7.1 The trace every result carries

Every displayed amount has a `Trace`:

- **Rule applied**: id and human name (for example `C3.proportionateDeduction`).
- **Input values**: each with its unit and provenance (fixture, upload, user-confirmed).
- **Source clause**: document, version, page, clause id, quoted text.
- **Formula**: the deterministic operation, shown as text (for example `deduction = item × (1 − 5,000 ÷ 7,500)`) and checked by id in tests.
- **Computed result**: in paise, displayed in rupees.
- **Unresolved assumptions**: anything the rule needed that is not established, listed by `UncertaintyReason`.

A result without a valid trace cannot be rendered; the component type requires it.

### 7.2 Unknown is not zero

Missing information never becomes ₹0 and never becomes an assumed coverage condition. The `Money` type has no "unknown" value; an unknown amount is represented by the absence of a `Money` and the presence of an `UncertaintyReason`. Totals that contain an unknown component are shown as "at least ₹X, plus items not yet classified", never as a single figure. Every total is labelled as potential deductions covered by this simulation, never as total out-of-pocket cost, because the engine models only the mechanisms in the ruleset.

### 7.3 Ranges only with defensible bounds

A range is produced only when the unresolved condition has a finite set of outcomes and the engine can compute the result for each. Example: whether the hospital follows differential billing is a yes/no fact; the range runs from the no-deduction result to the full-deduction result, and both bounds are shown with their own trace. If a condition does not have enumerable outcomes (for example an item whose classification the wording does not address), there is no range; the item is unresolved and excluded from every total.

### 7.4 The five result states

| State | Meaning | How it is shown |
|---|---|---|
| **Calculated** (verified, rule-based) | Every input established from the documents or confirmed by the user; the rule's conditions all established | Plain ink, full weight; "Calculated" badge; click for trace |
| **Conditional estimate** | The rule applies if a named condition holds; the condition is not yet established | Amber badge "If: hospital follows differential billing"; range shown with both bounds |
| **Missing or ambiguous input** | The documents do not provide, or contradict, an input the rule needs | Grey badge "Cannot determine"; the amount cell shows a dash, never 0; reason text |
| **Excluded from this calculation** | The policy's own definition keeps this item out of this rule | Neutral badge "Not subject to deduction (C4)"; the item still appears in the bill |
| **Requires insurer confirmation** | A fact the policy is silent on, or that only the insurer can settle | Blue badge "Requires insurer confirmation"; listed in the uncertainty panel with what to ask |

If the relevant policy term is absent, contradictory, or ambiguous, the engine returns an explicit inability-to-determine result for that rule and marks every dependent output accordingly.

---

## 8. Source handling

**Decision D1 (§16): the MVP ships with a clearly labelled synthetic demo policy as the primary live-demo fixture, and the ingestion adapter is the path by which a verified real wording replaces it without touching the engine. The synthetic fixture proves nothing about accuracy on real insurer policies, and no such claim is made anywhere.**

What was checked, today, from primary sources (Appendix B):

- IRDAI's 2020 "Norms on Proportionate Deductions" circular is public on irdai.gov.in and its text is readable. It is the authoritative statement of how proportionate deductions were constrained in India from October 2020 **(verified)**.
- IRDAI's Master Circular on Health Insurance Business (29 May 2024) supersedes that circular; its Annexure-6 lists it as item 19 **(verified)**. The master circular's body contains no proportionate-deduction norms that this review could find; its Customer Information Sheet template has a "Room / ICU charges beyond ____" sub-limit row **(verified)**. Whether the 2020 substance continues under the IRDAI (Insurance Products) Regulations 2024 is **not verified**.
- No insurer policy wording PDF was fetched or verified today.

Why synthetic, given that: a real wording would attribute the demo's conclusions to a named insurer and a named product. Encoding only its room-rent rules while leaving its co-payment, zone, package and sub-limit clauses unencoded would misstate that insurer's policy on stage. Verifying a full wording's provenance and encoding it faithfully is more than the week allows alongside the deck. A synthetic policy carries no such risk and lets the fixture include the exact cases the demo needs (a conditional deduction, an unclassified item, a contradictory schedule variant, a missing schedule variant).

How the synthetic policy is built: "Claim Sach Demo Health Policy, wording v1.0 (synthetic)". Issuer field: `No insurer. Synthetic demo policy created for Claim Sach.` Its clauses C1 to C5 (Appendix A) follow the structure the 2020 norms required of real policies: a defined "Associated Medical Expenses" class, the three barred cost classes plus ICU kept out of it, and the differential-billing condition. Every clause has an id, page and full text in the fixture so the UI can quote it.

How the choice is shown in the UI: a persistent label on the Scenario overview and in every trace: **"Synthetic demo policy. Not issued by any insurer."** The badge is part of `PolicyMetadata.issuer`, and acceptance test 12 asserts that a synthetic policy and an insurer-issued one render differently. A "Regulatory context" card may quote the 2020 norms with their reference number and the sentence "superseded by IRDAI's Master Circular of 29 May 2024; current status of these norms not verified by this tool". No unverified text is ever shown as a quote.

Path to a real wording: a ruleset JSON (or, as stretch, PDF text with reviewed candidates) whose `issuer.kind` is `insurer` and whose `sourceDocument` records the URL, title, UIN and version. The engine is unchanged. The switch is made only when the exact official wording, the relevant schedule information and the applicable clauses are verified, recorded in the fixture and tested, and only if that can be done without destabilising the demo.

---

## 9. Privacy and security

- **No personal data reaches a third-party AI.** Schedules, identity details, medical information and hospital bills never leave the browser. The optional LLM adapter can only be given public policy-wording text and already computed structured results, and it is off unless an environment variable turns it on.
- **Synthetic patient and bill data only** in the demo: the insured is "Demo Insured (synthetic)", the hospital is "Demo Hospital (synthetic)", the procedure and amounts are invented.
- **No logging of raw documents.** Nothing is logged except application errors without payloads. No analytics. No cookies beyond what Next.js needs for routing.
- **Client-side processing** for uploads: files are parsed in the browser, never POSTed. Limits: 5 MB per file; `.json` and `.csv` only (`.pdf` as stretch, text extraction only); a parse must finish within a bounded time or fail; file contents are held in memory for the session and discarded on reset or reload.
- **If a backend ever has to touch an upload** (not in the MVP): temporary processing only, strict size and type limits, safe file handling, immediate cleanup, no persistence.
- **No secrets in the repository.** `.env.example` lists the optional variable; `.env*` is git-ignored; nothing prints keys.
- **Dependencies** kept minimal and pinned; `npm audit` run before any push.
- **On-screen disclaimer**, visible on every screen's footer and in the trace panel:

> This is a scenario estimate of the potential deductions covered by this simulation, based on the inputs shown. It is not your total out-of-pocket cost: policy terms this version does not model are listed under "What remains uncertain". It is not a guarantee of coverage, not a claim decision, and not advice. Your insurer's final determination may differ. Confirm with your insurer and hospital before admission.

---

## 10. UX principles and the five screens

### 10.1 Principles

- Premium, calm, trustworthy: neutral surfaces, strong typography, deliberate whitespace, restrained colour used only to mark the five result states and evidence.
- Indian-rupee formatting everywhere: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`, lakh/crore grouping (₹3,23,500), whole rupees in tables, paise visible only inside a trace.
- Calculated, conditional and unknown results are distinguishable without colour (badge text and a dash for unknown), for accessibility.
- Fast state changes; no decorative animation; one highlight on changed rows.
- Responsive from 360 px up; keyboard-operable controls; visible focus; sufficient contrast.
- Loading, empty and error states are designed, not default.
- No trust badges, no accuracy score, no "AI-powered" sparkle.
- A user understands the result without asking a chatbot anything.

### 10.2 The screens

1. **Scenario overview.** Policy card (name, wording version, schedule id, sum insured, synthetic/insurer label), room choice control (category list with rates, editable rate, days), estimate summary (item count, hospital label), the room rent and the scenario total recalculated for the selected room, and the headline: "Potential deductions covered by this simulation", shown as a calculated figure, a range, or "at least ₹X plus unclassified items", with the state badge and the sub-line "Not your total out-of-pocket cost; terms not modelled are listed under What remains uncertain". Primary action: "Open Coverage Twin".
2. **Coverage Twin.** Two columns, A and B, each with its room choice at the top. Rows are the bill items; each row shows the amount, its classification, what the policy would leave unpaid under that scenario, and the state badge. A delta column between the two. Footer rows: room rent at the selected rate (rate × days); scenario total (non-room items plus room rent: ₹3,11,500, ₹3,23,500 and ₹3,41,500 for the three fixture rooms); calculated deductions; conditional deductions (range); unclassified items. "Change your room. See the difference." is the default A/B pair. Click any amount for its trace.
3. **Why this changed.** For each row whose result differs between A and B: the rule, the quoted clause with its id and page, the inputs (eligible rate, actual rate, days, item amount, ratio), the formula, the output under A and under B. Opened from the Twin; also reachable as a tab.
4. **What remains uncertain.** Grouped by resolvability: what the user can confirm now (with a control that takes them to Input review), what the hospital must confirm, what requires insurer confirmation, and what cannot be resolved from these documents at all; plus a fifth group, "Not modelled by this version": co-payment, sub-limits other than the room and ICU limits, exclusions and waiting periods, non-payable items, pre- and post-hospitalisation expenses, package-rate differences, and any other term in the wording the ruleset does not encode. This group is how unmodelled costs and policy terms are disclosed. Each entry names the affected items and the amount at stake, as a range only where §7.3 allows.
5. **Input review.** Every input the engine will use, with its value, provenance (fixture / upload / user-confirmed) and a confirm or correct control. Unconfirmed extracted values are not used. Changing a value re-runs the engine and updates provenance in every trace.

A top bar carries the policy label, "Reset to demo", and the uncertainty count as a persistent control.

---

## 11. Demo

### 11.1 The three-minute judge-facing sequence (exact clicks)

| Time | Click | Judge sees |
|---|---|---|
| 0:00 | Open `http://localhost:3000` (already loaded) | Scenario overview: synthetic demo policy v1.0, sum insured ₹5,00,000, room limit 1% of sum insured per day (₹5,000), Demo Hospital estimate for a total knee replacement, 4 room days plus 1 ICU day, room choice Single private ₹7,500/day, room rent ₹30,000, scenario total ₹3,23,500. Headline, "Potential deductions covered by this simulation": ₹15,000 calculated (₹10,000 room excess, ₹5,000 ICU excess); ₹0 to ₹38,000 conditional; ₹7,500 not classified. Sub-line: not your total out-of-pocket cost. |
| 0:25 | "Open Coverage Twin" | A: Twin-sharing ₹4,500 (room rent ₹18,000, scenario total ₹3,11,500). B: Single private ₹7,500 (room rent ₹30,000, scenario total ₹3,23,500). Rows light up where B differs: room rent, nursing, surgeon, anaesthetist, OT. Implant, pharmacy, diagnostics: "Not subject to deduction (C4)". ICU: "ICU limit, ₹5,000 over" in both. Physiotherapy, admin: "Cannot determine". |
| 0:55 | Click the surgeon row in B | Trace: C3, quoted text, ratio 5,000 ÷ 7,500, ₹60,000 × (1 − 2/3) = ₹20,000, state Conditional: "if the hospital follows differential billing". |
| 1:20 | Click the room-rent row in B | Trace: C1, ₹7,500 − ₹5,000 = ₹2,500 per day × 4 days = ₹10,000, state Calculated. |
| 1:35 | Open "What remains uncertain" | Four groups: user can confirm (differential billing: not stated on the estimate; range ₹0 to ₹38,000), requires insurer confirmation (room upgrade when the eligible category is unavailable: wording silent), cannot determine (physiotherapy ₹6,000, hospital admin ₹1,500: not classified by the wording), and not modelled by this version (co-payment, other sub-limits, exclusions, waiting periods, pre- and post-hospitalisation). |
| 2:05 | Go to Input review, set "Hospital follows differential billing" to Yes (confirmed by user) | The range collapses: B's potential deductions from the room choice become ₹48,000 calculated; provenance in every trace now reads "user-confirmed". The unclassified ₹7,500 stays unclassified. |
| 2:30 | Back on the Twin, change B's room to Deluxe ₹12,000 | B recalculates: room rent ₹48,000, scenario total ₹3,41,500; ratio 5 ÷ 12; potential deductions from the room choice ₹94,500; every changed row highlighted; "Why this changed" shows the new ratio. |
| 2:50 | Click "Reset to demo" | Back to the opening state. Close: "Every number you saw has a clause behind it. Everything we could not establish, and everything this version does not model, is on that panel, not hidden in a total." |

### 11.2 The two cases

- **Valid calculation:** the room-rent limit (C1) and, once differential billing is confirmed, the proportionate deduction (C3) on the four associated items.
- **Ambiguous case the engine refuses to overstate:** before confirmation, the deduction is a conditional range with both bounds traced; the two unclassified items are never folded into a total; the "room upgrade on non-availability" question is marked as requiring insurer confirmation because the wording is silent.

### 11.3 Offline fallback and reset

The app has no network dependency in demo mode: fixture in the bundle, no fonts fetched at runtime (self-hosted), no analytics. Fallback order if something fails on stage: (1) the production build on `localhost`; (2) the dev server; (3) a recorded screen capture of the same sequence, made on Friday 30 October, played from the laptop. "Reset to demo" clears session state and reloads the fixture; it is also what we press before every judge.

---

## 12. Costs

### 12.1 Money

Target for the build and the demo: **₹0**.

| Item | MVP | Cost |
|---|---|---|
| Framework, libraries, tests, CI | Next.js, Tailwind, Zod, Vitest, GitHub Actions on a public or private personal repository | ₹0 |
| Hosting | Vercel Hobby tier for a shareable link; `localhost` for the demo | ₹0 |
| Database | None | ₹0 |
| LLM | None required; adapter stub only | ₹0 |
| Domain | None; the Vercel subdomain or `localhost` | ₹0 |

What would cost money if added, with the amounts labelled **(assumption, verify before quoting in the deck)**:

| Optional item | What it buys | Estimated cost |
|---|---|---|
| An API key for the optional LLM adapter | Candidate-clause suggestions and prose explanations | Pay per use; the demo's few dozen short calls would cost tens of rupees at current list prices (assumption; read the provider's pricing page before stating a figure) |
| A domain | A memorable URL on the deck | About ₹700 to ₹1,500 for the first year at Indian registrars (assumption) |
| A paid host | Team features, more bandwidth | Vercel Pro is published at US$20 per member per month (last known; verify), roughly ₹1,700 per month at current rates (assumption); not needed |
| Travel to Bellandur on 31 October | | Out of scope |

### 12.2 Time, in hours, mapped to the deadlines

Estimates **(assumption)**; solo build.

| Phase | When | Hours | Done when |
|---|---|---|---|
| PRD v1.0, revision to v1.1, approval | Sat 24 Oct evening | 3 | Pushkar approves v1.1 in the session |
| Scaffold, engine, fixture, acceptance tests, eval harness skeleton; one-hour documented competitor review | Sun 25 Oct | 9 | All 13 acceptance tests pass; `npm run eval` prints results; `docs/COMPETITORS.md` written |
| Morning: minimal Coverage Twin screen for a screenshot, deck drafted and submitted. Evening: build resumes | Mon 26 Oct | 3 screen + 3 deck + 3 build | Deck uploaded by 17:30 IST; hard stop 00:00 IST that night |
| Five screens, uncertainty panel, input review, formatting, offline check | Tue 27 to Thu 29 Oct | 18 | §5.3 met; docs written; CI green |
| Rehearsal, fallback capture, demo script freeze | Fri 30 Oct | 4 | Three full rehearsals; recording made |
| Event: polish and rehearse only, no new features | Sat 31 Oct, 10:00 to 17:00 | 7 | Submission at 17:00; demo at 18:00 |
| **Total** | | **50** | |

Shortlisting is by the deck; if the team is not shortlisted, the build after Monday stops.

---

## 13. Why Paytm

Only verified facts, and the business case only as hypotheses with tests.

**Facts (verified by the planning session; sources in Appendix C):**

- Paytm Insurance Broking Private Limited holds an IRDAI Direct (Life & General) broker licence, Registration No. 700, renewed on 9 February 2026 and valid to 16 February 2029.
- It distributes car, two-wheeler, health, life and term policies from 18 or more insurers, including Niva Bupa and Aditya Birla Health. It does not underwrite.
- It already offers claim assistance by phone.
- Its FY25 turnover was ₹37.1 crore with a ₹13.2 crore loss (Form AOC-1, One 97 Communications Annual Report FY25), inside a financial-services line of ₹2,593 crore in FY26. **Insurance is a small line for Paytm today.**
- Paytm Intelligence ("Pi", announced September 2026, press reports) includes a claim-credibility model.
- Bima Sugam is not live; IRDAI's estimate is November 2026. It is mentioned only in the future tense.

**Fit.** A licensed direct broker that distributes health policies from many insurers, does not underwrite, and already assists claims by phone is the natural home for a pre-admission coverage simulator: it serves the broker's customer, needs no insurer integration to be useful, and makes the phone assistance concrete. No integration with Paytm is claimed or built.

**Business-model hypotheses, each with the test that would confirm or kill it:**

| Hypothesis | Test |
|---|---|
| H1. Policyholders who run a pre-admission check contact claim assistance less often at claim time, and with fewer disputes | Pilot with one cohort; compare support contacts and dispute rate per claim against a matched cohort |
| H2. Shown the item-level consequence, users choose an eligible room more often | Measure the room-change rate inside the simulator, then, in a pilot, the share of claims with a room-rent deduction |
| H3. Insurers on the broker's panel will pay for, or co-brand, a coverage-clarity tool as a distribution-quality signal | Three conversations with panel insurers after the hackathon; a signed pilot letter is the pass |
| H4. A coverage check on the policy page lifts health-policy conversion or renewal on the Paytm app | A/B test on the policy page, if Paytm ever chooses to run one |

Revenue options that depend on those tests: a broker-side feature with no direct charge (retention and renewal), an insurer-paid integration, or a premium claim-assistance tier. None is asserted.

---

## 14. Risks and the answers to the twelve-point critique

| # | Critique | Answer |
|---|---|---|
| 1 | Not unique enough; explainers exist | Interactive, item-level deduction prediction with the clause visible beside every number, and accuracy measured on a reviewed set; not another explainer. Whether a competitor already offers this is a hypothesis, checked in a documented competitor review before the deck; the USP slide claims only what the review supports |
| 2 | Exact payouts are hard | The engine computes deductions by cause, not payouts; ranges only with defensible bounds; unresolved states where the documents do not settle it |
| 3 | Wording alone is not enough | The schedule is a required input; without it the tool refuses to estimate the room limit (acceptance test 7) |
| 4 | No guarantee of the insurer's decision | The disclaimer on every screen and the "requires insurer confirmation" state |
| 5 | The AI can misread clauses | The clause text is shown beside every statement; the LLM is not in the calculation path; retrieval and extraction accuracy are measured on a human-reviewed set before any figure is displayed |
| 6 | Checklists are insurer-specific | Claim preparation is a non-goal |
| 7 | Too much scope | One workflow, frozen in §3; stretch only after §5.3 |
| 8 | Unproven Paytm business case | Hypotheses with tests (§13), and a plain statement that insurance is small for Paytm today |
| 9 | Unclear integration | No integration claimed, built or mocked as real |
| 10 | Sensitive data | §9: nothing personal leaves the browser; synthetic demo data; no logging of documents |
| 11 | "Never makes things up" is absolute | We claim provenance plus measurement, not an absolute: every number has a trace, and the harness reports actual results |
| 12 | False sense of security | The uncertainty panel is as prominent as the numbers; unknown is never zero; totals that contain unknowns say so |

Other risks:

| Risk | Mitigation |
|---|---|
| Not shortlisted on the deck | Deck first on Monday with a real screenshot; the rest of the build is conditional |
| Solo build runs out of time | Priority order from the brief: correct traces, then the Twin, then uncertainty, then demo reliability, then foundation; stretch last |
| A real-policy question from a judge ("does this work on my policy?") | Honest answer: the ruleset format and ingestion adapter exist; a verified wording can be encoded; today's fixture is synthetic and says so |
| Regulatory status of the 2020 norms questioned | The UI quotes them with the supersession note; the engine depends on the policy's own clauses, not on the norms |
| Laptop or venue failure | Offline production build, dev server, and a recorded capture, in that order |

---

## 15. Pitch outline mapped to the seven deck sections

1. **Title slide.** Claim Sach: Coverage Twin. Track 2, AI-Powered Financial Journeys. "Know what your policy might leave you paying before admission." Team name(s).
2. **Problem statement.** People learn what their policy excludes at the hospital. The room-rent clause: a ₹2,500-a-day room gap that cuts the surgeon's fee by a third, under a definition only the policy wording can settle. General explainers stop at the concept; the gap we are testing is applying your own wording to your own bill.
3. **Proposed solution.** The workflow line: policy documents → structured rules → scenario → itemised potential deductions → source clause → explicit uncertainty. One screenshot of the Coverage Twin with "Change your room. See the difference." and the clause panel open.
4. **Technology / tech stack.** TypeScript, Next.js, Tailwind; a pure rules engine with integer-paise arithmetic and traces; ingestion adapters separate from the engine; no database; no LLM in the calculation path; Vitest, GitHub Actions; runs offline. The evaluation harness's four measures.
5. **USP.** Item-level, clause-cited, uncertainty-marked, interactive. Unknown is never zero. Every number is clickable. Stated as what the product does; any comparative claim is limited to what the documented competitor review supports.
6. **Impact and benefits.** What a policyholder gains before admission; what a broker's claim-assistance agent gains on the call. No numbers we have not measured; the harness results as of the deck date, with dataset size. Figures on this slide are potential deductions covered by the simulation, never total out-of-pocket cost.
7. **Business model.** The verified Paytm Insurance Broking facts; the four hypotheses and their tests; Bima Sugam in the future tense; "insurance is a small line for Paytm today, which is why clarity is a wedge worth testing" stated as a view, not a fact.

---

## 16. Decisions and open questions

### 16.1 Decisions (v1.1, Pushkar as product manager, 24 October 2026)

| # | Decision | Rationale | Condition to revisit |
|---|---|---|---|
| D1 | **Synthetic policy for the primary live demo.** The clearly labelled synthetic fixture (Appendix A) is the Coverage Twin's deterministic scenario. It is never represented as insurer-issued. Its rules follow the structure of verified source material (the IRDAI 2020 norms, with their supersession noted, Appendix B), and the ruleset format stays compatible with future verified insurer wordings | We control the wording, the expected calculations, the ambiguity cases and the test results, and cannot attribute an incomplete or misread calculation to a real insurer. The fixture proves nothing about accuracy on real policies, and no such claim is made | Add a real policy only if its exact official wording, relevant schedule information and applicable clauses can be verified and tested without destabilising the demo |
| D2 | **Deterministic engine first; LLM stub by default; optional adapter later.** The application is fully functional with no API key. The default configuration uses the stub and the deterministic fallback. Once the core workflow is stable (§5.3), an optional adapter may extract candidate clauses from public policy wordings; candidates need human confirmation before becoming executable rules. The LLM never determines a financial calculation and never receives personal medical information, private policy schedules or hospital bills. The demo stays offline-capable and deterministic | A broken AI integration is a liability, and a product with no visible AI capability is hard to position at an AI hackathon. AI-assisted extraction around a tested deterministic engine is the defensible middle; an LLM posing as an insurance calculator is not | None before Saturday; the adapter is wired only after §5.3 is met |
| D3 | **Deadline and internal target.** Hard stop 27 October 2026, 00:00:00 IST (the end of Monday 26 October), as printed on devSemble and confirmed in IST by its countdown (Appendix C); Luma's 11:59 PM IST on 27 October is later. Internal submission target Monday 17:30 IST | A reading of "6:30 PM" is the same instant expressed in UTC, not an earlier deadline. The 17:30 target makes the question moot and leaves six and a half hours of buffer | If the organiser publishes a different time |
| D4 | **Figures are "potential deductions covered by this simulation", never total out-of-pocket cost.** Unmodelled costs and policy terms are disclosed in the "Not modelled by this version" group of the uncertainty panel | The engine models the selected policy mechanisms only; calling the result a total would be false | None |
| D5 | **Differentiation is a hypothesis.** No "nobody else does this" claim in this document or the deck until a documented competitor review supports it; the review is scheduled for Sunday 25 October (§12.2) | Originality has not been checked against the market | The review's result sets the USP wording |

### 16.2 Open question

1. **Repository: name and timing.** Proposed name `claim-sach` on your personal GitHub account, created after the engine's acceptance tests pass on Sunday, so the first pull request already carries green tests. Say when, and whether public or private.

---

## Appendix A. Planned demo fixture (synthetic; to be confirmed by the engine's tests)

**Policy:** Claim Sach Demo Health Policy, wording v1.0 (synthetic). Issuer: none. Schedule `DEMO-SCH-0001`: sum insured ₹5,00,000; insured "Demo Insured (synthetic)".

Clauses (final text lives in the fixture; ids are stable):

- **C1 Room rent limit.** Room rent and boarding charges are payable up to 1% of the Sum Insured per day as stated in the Policy Schedule.
- **C2 ICU charges.** Payable up to 2% of the Sum Insured per day. The proportionate deduction in C3 does not apply to ICU charges.
- **C3 Proportionate deduction.** If the Insured Person occupies a room whose rent exceeds the limit in C1, Associated Medical Expenses are payable in the same proportion as the eligible room rent bears to the room rent actually incurred. This applies only where the Hospital follows differential billing based on room category.
- **C4 Associated Medical Expenses.** Nursing charges; fees of the surgeon, anaesthetist, medical practitioner and consultants; operation theatre charges. Does not include pharmacy and consumables, implants and medical devices, diagnostics, or ICU charges.
- **C5 Sum insured.** Total payable in a policy year does not exceed the Sum Insured.

Test variants: `DEMO-SCH-MISSING` (no schedule: the room limit cannot be determined); `DEMO-SCH-CONTRA` (schedule states ₹6,000 per day while C1 gives ₹5,000: review required).

**Estimate:** Demo Hospital (synthetic), total knee replacement, 4 room days + 1 ICU day. Room options: Twin-sharing ₹4,500/day; Single private ₹7,500/day; Deluxe ₹12,000/day. Differential billing: not stated. Non-room items are fixed at ₹2,93,500 across rooms; room rent is the selected daily rate × 4 days, so the scenario total is ₹3,11,500, ₹3,23,500 or ₹3,41,500.

| Item | Amount (B: Single private) | Classification (C4) |
|---|---|---|
| Room rent, 4 days | ₹30,000 | Subject to C1 limit |
| ICU, 1 day | ₹15,000 | ICU limit (C2); excluded from C3 |
| Nursing, 4 days | ₹4,000 | Included in deduction |
| Surgeon fees | ₹60,000 | Included in deduction |
| Anaesthetist fees | ₹15,000 | Included in deduction |
| Operation theatre | ₹35,000 | Included in deduction |
| Implant (knee prosthesis) | ₹1,20,000 | Excluded from deduction |
| Pharmacy and consumables | ₹25,000 | Excluded from deduction |
| Diagnostics | ₹12,000 | Excluded from deduction |
| Physiotherapy | ₹6,000 | Unknown (wording silent) |
| Hospital admin charges | ₹1,500 | Unknown (wording silent) |
| **Total (B: Single private)** | **₹3,23,500** | Non-room items ₹2,93,500 + room rent ₹30,000 |

Expected results (hand-computed; the tests assert these in paise):

| Scenario | Room rent (rate × 4) | Scenario total | Room excess (C1) | ICU excess (C2) | Deduction (C3) on ₹1,14,000 | Potential deductions from the room choice (C1 + C3) | Unclassified |
|---|---|---|---|---|---|---|---|
| A: Twin-sharing ₹4,500 | ₹18,000 | ₹3,11,500 | ₹0 | ₹5,000 | Not applicable (within limit) | ₹0 | ₹7,500 |
| B: Single private ₹7,500 | ₹30,000 | ₹3,23,500 | ₹10,000 | ₹5,000 | ₹0 to ₹38,000 until differential billing is confirmed; ₹38,000 once confirmed (ratio 2/3) | ₹10,000 to ₹48,000; ₹48,000 confirmed | ₹7,500 |
| B': Deluxe ₹12,000 | ₹48,000 | ₹3,41,500 | ₹28,000 | ₹5,000 | ₹0 to ₹66,500; ₹66,500 confirmed (ratio 5/12) | ₹28,000 to ₹94,500; ₹94,500 confirmed | ₹7,500 |

Per-item deduction under B, confirmed: nursing ₹1,333.33; surgeon ₹20,000; anaesthetist ₹5,000; OT ₹11,666.67 (sum ₹38,000.00). Under B': ₹2,333.33; ₹35,000; ₹8,750; ₹20,416.67 (sum ₹66,500.00). Rounding: half up at the paisa, once per item. The ICU excess of ₹5,000 (C2) is a calculated deduction in every scenario and is not part of the room-choice figure; the potential deductions covered by the simulation for scenario B, once differential billing is confirmed, are therefore ₹53,000 plus ₹7,500 unclassified.

## Appendix B. Regulatory verification record (24 October 2026)

| Document | What was done | Finding |
|---|---|---|
| IRDAI, "Modified Guidelines on Product filing in Health Insurance Business - Norms on Proportionate Deductions", Ref IRDAI/HLT/REG/CIR/151/06/2020, 11 June 2020 | PDF downloaded from irdai.gov.in; text extracted with `pdftotext`; two pages, scanned with an OCR layer (minor OCR artefacts in the text) | Clauses 3 to 9 readable. Clause 3: insurers proposing proportionate deduction of "associated medical expenses" for a higher room category must define the term in the policy. Clause 4: pharmacy and consumables, implants and medical devices, diagnostics may not be in the definition. Clause 5: no recovery beyond the defined class. Clause 6: no deduction where the hospital does not follow differential billing. Clause 7: no deduction for ICU charges. Clause 8: applies to products filed on or after 1 October 2020; existing contracts to be modified at renewal from 1 April 2021 |
| IRDAI, "Master Circular on Health Insurance Business", Ref IRDAI/HLT/CIR/PRO/84/5/2024, dated 29.05.2024, 17 pages, plus its Annexure PDF | Both PDFs downloaded from irdai.gov.in; text extracted | Chapter III(IV): "This Circular supersedes all the Guidelines/Circulars listed in Annexure-6." Annexure-6 item 19 is IRDAI/HLT/REG/CIR/151/06/2020. No clause on proportionate deductions or associated medical expenses found in the 17-page body. The Customer Information Sheet template (Annexure 1) includes "Room / ICU charges beyond ----" under sub-limits |
| Any insurer policy wording | Not fetched | Not verified; see §8 |

## Appendix C. Sources

- devSemble listing: https://devsemble.com/hackathons/Paytm%20Build%20for%20India%20AI%20Hackathon%20%E2%80%93%20Bengaluru%20-by-paytm. Re-read in a browser on 24 October 2026 at 19:10 IST: "Hackathon Starts 31/10/2026", "Registration Closes 27/10/2026", Stage 1 "DEADLINE 27/10/2026, 00:00:00", "Time remaining: 2d 4h 49m 44s". The countdown resolves to 27 October 2026, 00:00:00 IST, so the printed time is in the viewer's timezone (IST here). The same instant is 26 October, 18:30 UTC, which is how a viewer in UTC would see "6:30 PM"; it is not an earlier deadline. The seven deck sections are listed as in §5.1. Terms & Conditions v2026.10 as read by the planning session (`docs/PAYTM-HACKATHON-PLAN.md` §1).
- Luma page: https://luma.com/6afp5q46. Re-read 24 October 2026: "Submit your team's pitch deck on the hackathon platform by 11:59 PM IST, 27 Oct" (no year printed); "Only shortlisted teams are invited for Stage 2"; "Your registration is subject to host approval"; the same seven deck sections.
- IRDAI circular IRDAI/HLT/REG/CIR/151/06/2020: https://irdai.gov.in/documents/37343/365525/Modified+Guidelines+on+Product+filing+in+Health+Insurance+Business-Norms+on.pdf/7b50effc-e553-f0a6-389d-3ca90ab11af5?version=1.0&t=1631531502137&download=true
- IRDAI Master Circular on Health Insurance Business, 29 May 2024, and its Annexure: the two PDFs linked from https://irdai.gov.in/health-dept (document ids 5e707a91-b5de-1ec1-cf18-b66273a6839d and e65501d8-2731-6f5c-aaed-658f961289e1).
- Paytm Insurance Broking facts (licence, insurers, claim assistance, FY25 figures, FY26 financial-services line), Paytm Intelligence (press, September 2026) and Bima Sugam status (IRDAI estimate): verified by the planning session and supplied to this document; the planning session holds the citations (BSE filing February 2026; One 97 Communications Annual Report FY25, Form AOC-1).

## Appendix D. Differences between the execution brief and this PRD

Any difference found during Stage 2 is recorded here with the brief's reading, this document's reading, and which one the code follows (the brief).

1. **Terminology (v1.1).** The brief's workflow line says "itemized exposure". At Pushkar's instruction, user-facing labels say "potential deductions covered by this simulation" and never "total out-of-pocket cost", because the engine models only the selected mechanisms. The workflow, the calculations and the brief's structure are unchanged; only the label differs.
2. **Additions approved on 24 October 2026 (evening), beyond the frozen MVP.** Pushkar approved four blocks after the MVP was built and merged: (A) a real wording in the box, Arogya Sanjeevani (New India, IRDAI-hosted), partially encoded with a verification record, plus the engine extensions it needed (capped limits, ICU-triggered proportion, co-payment as a bounded range, caveats and notices); (B) the Ruleset builder, where a model's proposals are quote-verified and human-confirmed, with cached proposals and a live route that is off by default; (C) the room ladder, the question sheet and the evidence pack; (D) the sourced business case. Co-payment therefore moved from "stretch" (§3.6) to built. The brief's rule "do not claim that an integration works unless it is implemented and tested" is honoured: the live model route is documented as implemented and not exercised, and the proposals in the demo are labelled cached.
3. **Sixth screen.** The brief's five required screens are unchanged; the Ruleset builder is a sixth tab.
