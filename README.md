# Claim Sach

An evidence-backed, interactive health-insurance coverage simulator. Signature feature: **Coverage Twin**.

> Know what your policy might leave you paying before admission.

Claim Sach turns the terms of one health-insurance policy into structured rules, applies them to an itemised hospital estimate, and shows the **potential deductions covered by the simulation**, item by item, with the source clause beside every number and an explicit list of what could not be determined. Change the room and see what changes, and why.

It is not a chatbot, not a policy explainer, and not a guarantee of any insurer's decision. The result is never your total out-of-pocket cost; the terms this version does not model are listed on screen.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo scenario is already loaded: no upload, no account, no API key, no environment variable. The app runs fully offline (fonts are bundled, nothing is fetched).

Production build, also offline:

```bash
npm run build && npm start
```

## Demo

`docs/DEMO_SCRIPT.md` has the three-minute judge-facing sequence of clicks, the fallbacks and the likely questions. **Reset to demo** in the header restores the seeded state at any time.

## The policy in the box is synthetic

"Claim Sach Demo Health Policy, wording v1.0 (synthetic)" is not issued by any insurer. It is labelled as such in the header, on the overview and in every trace. Its clause structure follows what IRDAI's 2020 norms on proportionate deductions required of real policies (superseded in May 2024; see `docs/PRD.md` Appendix B). A real wording is loaded as a Claim Sach ruleset through **Input review**; every rule must quote its clause exactly or the file is refused.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run eval
```

`npm run eval` runs the evaluation harness (four separate measures) and rewrites `docs/EVALUATION-RESULTS.md`. CI runs all of the above on every pull request and fails if the committed results are stale.

## Documents

| File | What |
|---|---|
| `docs/PRD.md` | product requirements, decisions, the planned fixture, the regulatory verification record |
| `docs/ARCHITECTURE.md` | data flow, rules engine, provenance, privacy boundaries |
| `docs/DEMO_SCRIPT.md` | the three-minute demo, fallbacks, reset |
| `docs/EVALUATION.md`, `docs/EVALUATION-RESULTS.md` | test coverage, benchmark method, actual results, limitations |
| `docs/PITCH.md` | the pitch outline mapped to the seven deck sections |
| `docs/COMPETITORS.md` | the bounded competitor review behind the differentiation hypothesis |

## Layout

```
src/engine        pure TypeScript rules engine: money, classify, limits, deduction, evaluate, compare, trace
src/fixtures      the synthetic demo policy, schedule variants, estimate, scenarios
src/ingestion     JSON and CSV adapters (Zod), evidence cross-check, upload limits
src/retrieval     tf-idf clause retrieval (deterministic)
src/extraction    regex rule extraction: candidates for human review
src/explain       deterministic explainer; optional LLM adapter interface (stub only)
src/model         app state, reducer, engine inputs, headline, uncertainty groups
src/components    the five screens, Coverage Twin, trace drawer, upload section
src/lib           Indian-rupee formatting
tests/unit        Vitest unit tests
tests/eval        evaluation fixtures; scripts/eval.ts is the harness
```

## Privacy

Everything runs in the browser. Uploads are read with the File API and never sent anywhere; there is no server route, no analytics, no storage. The demo's insured, hospital and amounts are synthetic. No secrets are needed; `.env.example` documents the optional adapter variables, which nothing in this version uses.

## Not in this version

PDF ingestion; co-payment, sub-limits other than room and ICU, exclusions, waiting periods, non-payable items, pre- and post-hospitalisation (listed as not modelled in the app); any insurer or Paytm integration; persistence.
