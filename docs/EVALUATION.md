# Claim Sach: evaluation

What is tested, how the benchmark works, the actual results, and what they do not show.

## 1. Test coverage

`npm test` runs Vitest over the following (counts as of 24 October 2026):

| File | Covers |
|---|---|
| `tests/unit/money.test.ts` | integer-paise arithmetic, ratios, half-up rounding, exactness at scale |
| `tests/unit/classify.test.ts` | classification by the policy's own definition; user classification of unknowns; no override of policy-defined classes |
| `tests/unit/limits.test.ts` | room and ICU limits from the sum insured; missing schedule; contradictory schedule; excess within and above the limit |
| `tests/unit/evaluate.test.ts` | the three fixture rooms; conditional, confirmed and failed differential billing; edited rate; wording without the rule; schedule missing and contradictory; versions; synthetic label; determinism |
| `tests/unit/compare.test.ts` | deltas, changed rows, cause rules, range deltas |
| `tests/unit/trace.test.ts` | a valid trace on every calculated, conditional or excluded amount across five scenarios; rejection of tampered traces |
| `tests/unit/model.test.ts` | app state, demo variants, edits, uploads overriding documents, headline text, uncertainty grouping |
| `tests/unit/ingestion.test.ts` | JSON schema and evidence checks, CSV parsing, size and type limits, never throwing |
| `tests/unit/retrieval.test.ts`, `extraction.test.ts` | the deterministic retriever and extractor |
| `tests/unit/explain.test.ts` | plain-words explanations; adapter fallback |
| `tests/unit/format-inr.test.ts` | Indian-rupee formatting |

### The brief's acceptance tests

| # | Acceptance test | Where |
|---|---|---|
| 1 | Selected room within the entitlement | `limits.test.ts` "is zero, and calculated…"; `evaluate.test.ts` scenario A |
| 2 | Selected room exceeds the entitlement | `limits.test.ts` "(rate − eligible) × days"; `evaluate.test.ts` scenario B |
| 3 | Proportionate deduction only when the rule is explicitly applicable | `evaluate.test.ts` "applies the proportionate deduction only when the wording has the rule", "applies no deduction when the estimate states…" |
| 4 | Associated items classified by the selected policy's rules | `classify.test.ts` |
| 5 | Excluded categories not included in a deduction | `classify.test.ts`; `evaluate.test.ts` "does not deduct from excluded items" |
| 6 | Unknown classification produces uncertainty, not a number | `evaluate.test.ts` "keeps unclassified items out of every total" |
| 7 | Missing schedule prevents a definitive result | `limits.test.ts`; `evaluate.test.ts` "cannot produce a definitive result without the policy schedule" |
| 8 | Contradictory terms produce review-required | `limits.test.ts`; `evaluate.test.ts` "returns review-required…" |
| 9 | Changing the room recalculates all dependent outputs | `evaluate.test.ts` scenario B′ and "honours an edited room rate"; `model.test.ts` |
| 10 | Every displayed calculated result has a valid trace | `trace.test.ts` |
| 11 | Currency-safe arithmetic | `money.test.ts` |
| 12 | Synthetic policy distinguishable from an insurer-issued one | `evaluate.test.ts` "makes a synthetic policy distinguishable…"; `ingestion.test.ts` (insurer-issued rulesets must carry a source URL) |
| 13 | Malformed uploads and unsupported types fail safely | `ingestion.test.ts` "readUpload…" |

Not covered: React component rendering (no DOM tests). The screens were checked by hand in a browser on 24 October 2026 at desktop and phone widths.

## 2. Benchmark methodology

The harness (`npm run eval`, `scripts/eval.ts`) keeps four measures separate, each reported as k of n with every failure listed verbatim:

1. **Clause retrieval accuracy (top-1).** Questions a policyholder might ask, each labelled with the clause a careful reader would point to. The retriever's first hit must match.
2. **Rule extraction accuracy (field-level).** The deterministic extractor runs over the wording's clauses; each field of its output (clause id, basis, conditions, included and excluded categories, cap) is compared with the human-reviewed ruleset.
3. **Calculation correctness (exact match in paise).** Scenarios with expected amounts computed by hand in `docs/PRD.md` Appendix A before the engine existed. A scenario passes only if every expected amount matches exactly.
4. **Uncertainty and refusal quality.** Cases where something is missing, contradictory or unclassified, each with the expected overall state, the values that must stay unknown, and the uncertainty codes that must be present. Any number where there should be none is a failure.

Fixtures live in `tests/eval/fixtures.ts`. They were authored on 24 October 2026 by the build session from the PRD's hand-computed appendix. **Human review by Pushkar Mondal is pending**; the results file says so until that changes.

No accuracy figure is shown in the product UI. The only numbers are the ones below, and they carry their dataset size.

## 3. Actual results

From `docs/EVALUATION-RESULTS.md`, generated by `npm run eval` (engine 0.1.0; fixtures 2026.10.24-1). Two datasets: the synthetic wording and the ten encoded clauses of the real Arogya Sanjeevani wording.

| Measure | Synthetic wording | Arogya Sanjeevani (10 encoded clauses) |
|---|---|---|
| Clause retrieval accuracy (top-1) | 11 of 12 | 10 of 12 |
| Rule extraction accuracy (field-level) | 10 of 10 | 10 of 12 |
| Calculation correctness (exact match in paise) | 9 of 9 scenarios, 46 of 46 amounts | 3 of 3 scenarios, 29 of 29 amounts |
| Uncertainty and refusal quality | 6 of 6 | 3 of 3 |
| LLM proposals: quotes verified verbatim (cached) | not applicable | 6 of 6 |
| LLM proposals: field agreement with the reviewed ruleset (cached) | not applicable | 11 of 13 |

The misses, all kept as measured: on the synthetic wording, "Is pharmacy subject to the proportionate deduction?" returned C3 where the label expects C4. On the real wording, two retrieval questions returned the definition clauses (3.47, 3.27) instead of the limit clauses (4.1(a), 4.1(b)); and both the regex extractor and the cached proposals read "all other expenses except medicines" literally, including hospital admin charges and excluding the mixed pharmacy-and-consumables line, where the human reviewer left both unclassified. Those two fields are the whole reason the builder requires a person to confirm.

The LLM proposal rows measure **cached** proposals written by the build session offline, not an API run.

CI re-runs the harness on every pull request and fails if the committed results differ from a fresh run.

## 4. Limitations

- **One real wording, ten clauses.** The real-wording numbers cover only the encoded clauses of one standard product with a synthetic schedule and estimate; they say nothing about the rest of that policy, about other insurers, or about real schedules.
- **The LLM proposals are cached.** They were written by the build session reading the wording offline; no API call was made. A live run may do better or worse.
- **Small fixtures.** Twelve questions, ten fields, nine scenarios, six refusal cases. Enough to catch regressions, not enough to generalise.
- **Extractor built against the demo's phrasing.** Its 10 of 10 reflects regular expressions written for sentences like the fixture's. On other wordings it will miss or mis-read; that is why it only proposes candidates.
- **Retrieval is keyword-based.** It has no notion of meaning beyond a short synonym table.
- **Calculation fixtures share their author with the engine.** The expected values were written by hand before the engine ran, but by the same session that wrote the engine. Independent review is the next step.
- **No component tests.** The UI's correctness rests on the model's tests and manual checks.

## 5. Re-running

```bash
npm test
npm run eval
```

`npm run eval` rewrites `docs/EVALUATION-RESULTS.md`. Commit the change with the code that caused it.
