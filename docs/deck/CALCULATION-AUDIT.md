# Calculation audit for the pitch deck (25 October 2026, revised the same day)

Every figure the deck shows for the real wording is derived here by hand from the quoted clauses, then compared with the engine. Re-run the engine side with:

```bash
npx tsx scripts/deck-figures.ts
```

The evaluation harness (`npm run eval`) independently checks 29 hand-computed amounts over three scenarios on this wording and 46 over nine on the synthetic wording; its committed results are in `docs/EVALUATION-RESULTS.md`.

**Revision.** The first version of this audit, and the engine until 25 October 2026, bounded the conditional total by adding each component's own bounds (the caveated items' range plus the co-payment's range). Those bounds were not jointly achievable: the top of the range paired the maximum reduction on implants and diagnostics with a co-payment computed as if that reduction had not happened. The engine now enumerates every jointly possible outcome of the open questions, computes the co-payment inside each outcome, and takes the minimum and maximum of the complete totals. The co-payment's own range is unchanged, because each of its bounds is achievable in some outcome; the conditional totals narrowed. The tests pin the new values (`tests/unit/arogya.test.ts`, `tests/eval/fixtures-nia.ts`).

## Inputs

- Wording: Arogya Sanjeevani Policy, The New India Assurance Co. Ltd., UIN NIAHLIP20165V011920 (2019-20 filing), ten clauses encoded verbatim from the PDF hosted on irdai.gov.in (SHA-256 `4e261c78014a210c3ba30aa813c820bfeb7751d153afd7e52e64be4d8f542d44`). Partially encoded; everything not listed below is not modelled.
- Schedule: synthetic, sum insured ₹5,00,000.
- Estimate: synthetic, total knee replacement, 4 room days, one ICU day at ₹15,000; non-room items ₹2,93,500: nursing ₹4,000, surgeon ₹60,000, anaesthetist ₹15,000, operation theatre ₹35,000, implant ₹1,20,000, pharmacy and consumables ₹25,000, diagnostics ₹12,000, physiotherapy ₹6,000, hospital admin ₹1,500, ICU ₹15,000.
- Rooms: twin-sharing ₹4,500 a day, single private ₹7,500, deluxe ₹12,000.

## Clauses applied (quoted verbatim from the wording)

- **4.1(a), page 7.** "Room Rent, Boarding, Nursing Expenses as provided by the Hospital / Nursing Home up to 2% of the sum insured subject to maximum of Rs.5000/-, per day."
- **4.1(b), page 7.** "Intensive Care Unit (ICU) / Intensive Cardiac Care Unit (ICCU) expenses up to 5% of sum insured subject to maximum of Rs.10,000/- per day."
- **4.1.1 Note (b), page 7.** "In case of admission to a room/ICU/ICCU at rates exceeding the aforesaid limits, the reimbursement/payment of all other expenses incurred at the Hospital, with the exception of cost of medicines, shall be effected in the same proportion as the admissible rate per day bears to the actual rate per day of Room Rent/ICU/ICCU charges."
- **9.5, page 14.** "Each and every claim under the Policy shall be subject to a Co-Payment of 5% applicable to claim amount admissible and payable as per the terms and conditions of the Policy. The amount payable shall be after deduction of the Co-Payment."

How the engine reads them, as encoded in `src/fixtures/arogya-sanjeevani-nia/ruleset.ts`:

- For each category, the applicable daily limit is the lower of the percentage-of-sum-insured amount and the stated daily cap: room min(2% × SI, ₹5,000); ICU min(5% × SI, ₹10,000).
- Note (b) is triggered by the room rate or the ICU rate exceeding its limit. The ratio is admissible ÷ actual for the limit that was exceeded. If both are exceeded in the same ratio, that ratio applies; if in different ratios, the engine refuses to choose and treats the choice as an open question with two outcomes.
- "All other expenses … with the exception of cost of medicines": nursing, surgeon, anaesthetist, consultant, operation theatre, implant, diagnostics and physiotherapy are in the reduced class. Pharmacy and consumables is left unclassified because the line mixes medicines (excepted) with consumables (not addressed). Hospital admin charges are left unclassified because the wording does not say whether an administrative charge is a covered expense at all.
- Implants and diagnostics carry the caveat `WORDING_PREDATES_2020_NORMS` (see "Regulatory note" below): an open question with two outcomes, the insurer applies the reduction or does not.
- Co-payment = 5% of the admissible amount, where admissible = scenario total − room excess − ICU excess − item deductions − unclassified items treated as not admissible.
- Money is integer paise; ratios are reduced fractions; each multiplication rounds half up at the paisa once.

## Joint outcomes: how the conditional total is bounded

The open questions in a scenario each have a finite set of outcomes: differential billing established or not (synthetic wording only), the room or the ICU ratio when they differ, each caveat applied or not, and each unclassified item admissible or not. The engine forms every combination (`DeductionWorld` in `src/engine/deduction.ts`, crossed with admissibility in `src/engine/evaluate.ts`). In each combination every conditional item has one value and the co-payment is 5% of what that combination leaves admissible. The conditional total of the scenario is bounded by the smallest and the largest complete total; the bounds therefore come from two specific, named outcomes, and the basis text on the result names them. The co-payment's own range is the smallest and largest co-payment over the same combinations.

## Single private room, ₹7,500 a day (the room on the deck)

| Step | Arithmetic | Result |
|---|---|---|
| The bill, ten non-room lines | ICU 15,000 + nursing 4,000 + surgeon 60,000 + anaesthetist 15,000 + operation theatre 35,000 + implant 1,20,000 + pharmacy and consumables 25,000 + diagnostics 12,000 + physiotherapy 6,000 + hospital admin 1,500 | ₹2,93,500 |
| Scenario total | ₹30,000 room rent (₹7,500 × 4) + ₹2,93,500 | ₹3,23,500 |
| Applicable room limit, 4.1(a) | min(2% × ₹5,00,000 = ₹10,000, ₹5,000) | ₹5,000 a day |
| Room excess | (₹7,500 − ₹5,000) × 4 days | **₹10,000** |
| Applicable ICU limit, 4.1(b) | min(5% × ₹5,00,000 = ₹25,000, ₹10,000) | ₹10,000 a day |
| ICU, 1 day at ₹15,000: excess | (₹15,000 − ₹10,000) × 1 day. The ICU line is a bill item in its own right, governed by the ICU limit; it is never in the Note (b) class, which covers the "other expenses". Its only deduction is this excess | **₹5,000** |
| Ratio, Note (b) | room 5,000 ÷ 7,500 = 2/3; ICU 10,000 ÷ 15,000 = 2/3; same, so 2/3 applies; deduction = item × (1 − 2/3) = item ÷ 3 | 2/3 |
| Nursing | ₹4,000 ÷ 3 | ₹1,333.33 |
| Surgeon | ₹60,000 ÷ 3 | ₹20,000.00 |
| Anaesthetist | ₹15,000 ÷ 3 | ₹5,000.00 |
| Operation theatre | ₹35,000 ÷ 3 | ₹11,666.67 |
| Physiotherapy | ₹6,000 ÷ 3 | ₹2,000.00 |
| Implant (caveat) | ₹0 or ₹1,20,000 ÷ 3 | ₹0 to ₹40,000 |
| Diagnostics (caveat) | ₹0 or ₹12,000 ÷ 3 | ₹0 to ₹4,000 |
| Pharmacy and consumables | not classified | — (₹25,000 shown apart) |
| Hospital admin | not classified | — (₹1,500 shown apart) |
| **Calculated deductions** | 10,000 + 5,000 + 1,333.33 + 20,000 + 5,000 + 11,666.67 + 2,000 | **₹55,000.00** |
| **Not classified** | 25,000 + 1,500 | **₹26,500** (2 items) |

Open questions: the caveat (reduction applied or not: ₹44,000 or ₹0) and the admissibility of the two unclassified items (₹26,500 in all). Four joint outcomes:

| Caveat | Unclassified items | Admissible base | Co-payment 5% | Conditional total |
|---|---|---|---|---|
| not applied | not admissible | 3,23,500 − 55,000 − 0 − 26,500 = 2,42,000 | ₹12,100 | 0 + 12,100 = **₹12,100** (low) |
| not applied | admissible | 2,68,500 | ₹13,425 | 13,425 |
| applied | not admissible | 2,42,000 − 44,000 = 1,98,000 | ₹9,900 | 44,000 + 9,900 = 53,900 |
| applied | admissible | 2,68,500 − 44,000 = 2,24,500 | ₹11,225 | 44,000 + 11,225 = **₹55,225** (high) |

(Admitting only one of the two unclassified items gives totals strictly between these.) So the co-payment is **₹9,900 to ₹13,425** and the conditional deductions are **₹12,100 to ₹55,225**. The old component-wise bounds, ₹9,900 to ₹57,425, are not achievable: ₹57,425 would need the reduction applied and the co-payment computed as if it were not.

Engine (25 October 2026): calculated 5500000 paise, co-payment 990000 to 1342500, conditional 1210000 to 5522500, unclassified 2650000, ratio 2/3, trigger "both". Match.

## Twin-sharing room, ₹4,500 a day

Room excess ₹0 (₹4,500 is within ₹5,000). ICU excess ₹5,000. Note (b) is triggered by the ICU rate alone; ratio 10,000 ÷ 15,000 = 2/3, so every reduced item is cut by one third exactly as above. Calculated = 0 + 5,000 + 13,000 + 20,000 + 5,000 + 2,000 = **₹45,000**. Scenario total ₹3,11,500.

Joint outcomes: low = reduction not applied, unclassified not admissible: 0 + 5% × (3,11,500 − 45,000 − 26,500 = 2,40,000) = **₹12,000**; high = reduction applied, unclassified admissible: 44,000 + 5% × (3,11,500 − 45,000 − 44,000 = 2,22,500) = 44,000 + 11,125 = **₹55,125**. Co-payment alone: ₹9,800 (reduction applied, not admissible) to ₹13,325 (not applied, admissible).

Engine: calculated 4500000, co-payment 980000 to 1332500, conditional 1200000 to 5512500, trigger "icu". Match. This is the "ICU surprise" on the deck: the proportion applies even in the eligible room.

## Deluxe room, ₹12,000 a day

Room excess (12,000 − 5,000) × 4 = ₹28,000; ICU excess ₹5,000; calculated = **₹33,000**. Ratios differ: room 5,000 ÷ 12,000 = 5/12 (deduction factor 7/12), ICU 2/3 (factor 1/3). The engine refuses to pick one, so the ratio is a third open question. Sixteen joint outcomes (ratio × caveat × two unclassified items); the reduced class without caveat totals ₹1,20,000, the caveated items ₹1,32,000; scenario total ₹3,41,500.

- Low: milder ratio (× 1/3), reduction not applied, unclassified not admissible: 40,000 + 5% × (3,41,500 − 33,000 − 40,000 − 26,500 = 2,42,000) = 40,000 + 12,100 = **₹52,100**.
- High: stricter ratio (× 7/12), reduction applied, unclassified admissible: 70,000 + 77,000 + 5% × (3,41,500 − 33,000 − 1,47,000 = 1,61,500) = 1,47,000 + 8,075 = **₹1,55,075**.
- Co-payment alone: ₹6,750 (stricter ratio, reduction applied, not admissible: 5% × 1,35,000) to ₹13,425 (milder ratio, not applied, admissible: 5% × 2,68,500).

Engine: calculated 3300000, co-payment 675000 to 1342500, conditional 5210000 to 15507500, applicability "conditional", ratio none, trigger "both". Match. The old component-wise bounds were ₹46,750 to ₹1,60,425.

## Synthetic wording (slide 2 of the deck)

Eligible rate 1% × ₹5,00,000 = ₹5,000 (C1); single private excess (7,500 − 5,000) × 4 = ₹10,000; ratio 2/3 (C3); C4 names nursing, surgeon, anaesthetist, consultant and operation theatre as associated medical expenses and excludes implants, pharmacy and consumables, and diagnostics; conditional on differential billing: nursing ₹1,333.33, surgeon ₹20,000, anaesthetist ₹5,000, operation theatre ₹11,666.67, total ₹38,000. ICU limit 2% × SI = ₹10,000 (C2), excess ₹5,000, never proportioned. There is no co-payment in this wording, and one open question (differential billing) with two outcomes, so the conditional total is ₹0 to ₹38,000 under both methods. Potential deductions from the room choice once differential billing is confirmed: ₹10,000 + ₹38,000 = **₹48,000**; calculated deductions ₹5,000 (twin) against ₹53,000 (single), as on slide 9. Physiotherapy and hospital admin are not classified by C4 and stay out of every total (₹7,500).

## Regulatory note (the caveat on implants and diagnostics)

Stated as a potential conflict, not a legal conclusion. IRDAI's "Modified Guidelines on Product filing in Health Insurance Business – Norms on Proportionate Deductions", Ref IRDAI/HLT/REG/CIR/151/06/2020, 11 June 2020, read from the PDF on irdai.gov.in (text extracted with pdftotext; OCR layer with minor artefacts):

- Clause 4: "The following expenses are not allowed to be part of the definition of 'associate medical expenses'. a. Cost of pharmacy and consumables; b. Cost of implants and medical devices c. Cost of diagnostics".
- Clause 6: no proportionate deduction where the hospital does not follow differential billing.
- Clause 7: "Insurers are not permitted to apply proportionate deduction for 'ICU charges'".
- Clause 8: applicable to products filed on or after 1 October 2020; existing non-compliant contracts "shall be modified as and when they are due for renewal from 01st April, 2021 onwards".

The 2019-20 Arogya Sanjeevani wording reduces "all other expenses … with the exception of cost of medicines", which on its face reaches implants and diagnostics. The circular itself was superseded on 29 May 2024 by the Master Circular on Health Insurance Business (Ref IRDAI/HLT/CIR/PRO/84/5/2024), which lists it as item 19 of Annexure-6; whether the same norm continues under the 2024 regime is not verified here.

The insurer's current customer information sheet for this product, "Customer Information Sheet AROGYA SANJEEVANI POLICY-MASTER WEF 01 10 2024" on newindia.co.in, read on 25 October 2026, carries UIN NIAHLIP25044V022425 on every page and the same Note (b) sentence: "In case of admission to a room/ICU/ICCU at rates exceeding the aforesaid limits, the reimbursement/payment of all other expenses incurred at the Hospital, with the exception of cost of medicines, shall be effected in the same proportion as the admissible rate per day bears to the actual rate per day of Room Rent/ICU/ICCU charges." The full current policy wording was not fetched, encoded or verified; the sheet itself says the policy document prevails over it. This project encodes the 2019-20 filing as a version-sensitivity test. Arogya Sanjeevani is a standardised product, but each ruleset must be verified against the exact insurer, UIN, policy wording and version before use; nothing here implies that one encoding is valid for every insurer or every version. The engine therefore marks implants and diagnostics "requires insurer confirmation" with a range, and the question sheet asks the insurer in writing. Nothing in the product or the deck asserts how the insurer settles claims.

## Limits of this audit

Ten clauses of a 31-page wording are encoded; sub-limits, exclusions, waiting periods, non-payable items, pre- and post-hospitalisation, package rates and the sum-insured cap are not modelled and are listed as such on screen. The schedule and estimate are synthetic. This document checks the arithmetic and the clause reading; it is not a legal opinion and not an insurer's claim decision.
