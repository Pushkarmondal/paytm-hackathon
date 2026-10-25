# Calculation audit for the pitch deck (25 October 2026)

Every figure the deck shows for the real wording is derived here by hand from the quoted clauses, then compared with the engine. Re-run the engine side with:

```bash
npx tsx scripts/deck-figures.ts
```

The evaluation harness (`npm run eval`) independently checks 21 hand-computed amounts over three scenarios on this wording and 46 over nine on the synthetic wording; its committed results in `docs/EVALUATION-RESULTS.md` were regenerated on 25 October 2026 with no change.

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

- Eligible room rate = min(2% × SI, ₹5,000); eligible ICU rate = min(5% × SI, ₹10,000).
- Note (b) is triggered by the room rate or the ICU rate exceeding its limit. The ratio is admissible ÷ actual for the limit that was exceeded. If both are exceeded in the same ratio, that ratio applies; if in different ratios, the engine refuses to choose and gives bounds.
- "All other expenses … with the exception of cost of medicines": nursing, surgeon, anaesthetist, consultant, operation theatre, implant, diagnostics and physiotherapy are in the reduced class. Pharmacy and consumables is left unclassified because the line mixes medicines (excepted) with consumables (not addressed). Hospital admin charges are left unclassified because the wording does not say whether an administrative charge is a covered expense at all.
- Implants and diagnostics carry the caveat `WORDING_PREDATES_2020_NORMS` (see "Regulatory note" below), so their deduction is a range from ₹0 (the insurer does not apply the reduction) to the full proportion.
- Co-payment = 5% of the admissible amount, where admissible = scenario total − deductions − items not admissible. Until every other amount is settled it is a range: the low bound treats unclassified items as not admissible and every open deduction at its maximum; the high bound treats unclassified items as admissible and every open deduction at its minimum.
- Money is integer paise; ratios are reduced fractions; each multiplication rounds half up at the paisa once.

## Single private room, ₹7,500 a day (the room on the deck)

| Step | Arithmetic | Result |
|---|---|---|
| Eligible room rate, 4.1(a) | min(2% × ₹5,00,000 = ₹10,000, ₹5,000) | ₹5,000 a day |
| Room excess | (₹7,500 − ₹5,000) × 4 days | **₹10,000** |
| Eligible ICU rate, 4.1(b) | min(5% × ₹5,00,000 = ₹25,000, ₹10,000) | ₹10,000 a day |
| ICU excess | (₹15,000 − ₹10,000) × 1 day | **₹5,000** |
| Ratio, Note (b) | room 5,000 ÷ 7,500 = 2/3; ICU 10,000 ÷ 15,000 = 2/3; same, so 2/3 applies; deduction = item × (1 − 2/3) = item ÷ 3 | 2/3 |
| Nursing | ₹4,000 ÷ 3 | ₹1,333.33 |
| Surgeon | ₹60,000 ÷ 3 | ₹20,000.00 |
| Anaesthetist | ₹15,000 ÷ 3 | ₹5,000.00 |
| Operation theatre | ₹35,000 ÷ 3 | ₹11,666.67 |
| Physiotherapy | ₹6,000 ÷ 3 | ₹2,000.00 |
| Implant (caveat) | ₹0 to ₹1,20,000 ÷ 3 | ₹0 to ₹40,000 |
| Diagnostics (caveat) | ₹0 to ₹12,000 ÷ 3 | ₹0 to ₹4,000 |
| Pharmacy and consumables | not classified | — (₹25,000 shown apart) |
| Hospital admin | not classified | — (₹1,500 shown apart) |
| **Calculated deductions** | 10,000 + 5,000 + 1,333.33 + 20,000 + 5,000 + 11,666.67 + 2,000 | **₹55,000.00** |
| Scenario total | ₹30,000 room rent + ₹2,93,500 | ₹3,23,500 |
| Co-payment low, 9.5 | 5% × (3,23,500 − 55,000 − 44,000 − 26,500 = 1,98,000) | ₹9,900 |
| Co-payment high, 9.5 | 5% × (3,23,500 − 55,000 − 0 − 0 = 2,68,500) | ₹13,425 |
| **Conditional deductions** | low 0 + 9,900; high 44,000 + 13,425 | **₹9,900 to ₹57,425** |
| **Not classified** | 25,000 + 1,500 | **₹26,500** (2 items) |

Engine (25 October 2026): calculated 5500000 paise, conditional 990000 to 5742500 paise, unclassified 2650000 paise, ratio 2/3, trigger "both". Match.

## Twin-sharing room, ₹4,500 a day

Room excess ₹0 (₹4,500 is within ₹5,000). ICU excess ₹5,000. Note (b) is triggered by the ICU rate alone; ratio 10,000 ÷ 15,000 = 2/3, so every reduced item is cut by one third exactly as above. Calculated = 0 + 5,000 + 13,000 + 20,000 + 5,000 + 2,000 = **₹45,000**. Scenario total ₹3,11,500. Co-payment low 5% × (3,11,500 − 45,000 − 44,000 − 26,500 = 1,96,000) = ₹9,800; high 5% × (3,11,500 − 45,000 = 2,66,500) = ₹13,325. Conditional **₹9,800 to ₹57,325**.

Engine: calculated 4500000, conditional 980000 to 5732500, trigger "icu". Match. This is the "ICU surprise" on the deck: the proportion applies even in the eligible room.

## Deluxe room, ₹12,000 a day

Room excess (12,000 − 5,000) × 4 = ₹28,000; ICU excess ₹5,000; calculated = **₹33,000**. Ratios differ: room 5,000 ÷ 12,000 = 5/12, ICU 2/3. The engine refuses to pick one and bounds every reduced item between the milder cut (× 1/3) and the stricter (× 7/12):

- Reduced class without caveat (₹1,20,000 in total: nursing, surgeon, anaesthetist, operation theatre, physiotherapy): ₹40,000 to ₹70,000.
- Implant and diagnostics (₹1,32,000, with caveat): ₹0 to ₹77,000.
- Co-payment: scenario total ₹3,41,500; low 5% × (3,41,500 − 33,000 − 70,000 − 77,000 − 26,500 = 1,35,000) = ₹6,750; high 5% × (3,41,500 − 33,000 − 40,000 = 2,68,500) = ₹13,425.
- Conditional: 40,000 + 0 + 6,750 = **₹46,750** to 70,000 + 77,000 + 13,425 = **₹1,60,425**.

Engine: calculated 3300000, conditional 4675000 to 16042500, applicability "conditional", ratio none, trigger "both". Match. These are the three rows of the room ladder on the deck.

## Synthetic wording (slide 2 of the deck)

Eligible rate 1% × ₹5,00,000 = ₹5,000 (C1); single private excess (7,500 − 5,000) × 4 = ₹10,000; ratio 2/3 (C3); C4 names nursing, surgeon, anaesthetist, consultant and operation theatre as associated medical expenses and excludes implants, pharmacy and consumables, and diagnostics; conditional on differential billing: nursing ₹1,333.33, surgeon ₹20,000, anaesthetist ₹5,000, operation theatre ₹11,666.67, total ₹38,000. ICU limit 2% × SI = ₹10,000 (C2), excess ₹5,000, never proportioned. Potential deductions from the room choice once differential billing is confirmed: ₹10,000 + ₹38,000 = **₹48,000**; calculated deductions ₹5,000 (twin) against ₹53,000 (single), as on slide 9. Physiotherapy and hospital admin are not classified by C4 and stay out of every total (₹7,500).

## Regulatory note (the caveat on implants and diagnostics)

Stated as a potential conflict, not a legal conclusion. IRDAI's "Modified Guidelines on Product filing in Health Insurance Business – Norms on Proportionate Deductions", Ref IRDAI/HLT/REG/CIR/151/06/2020, 11 June 2020, read from the PDF on irdai.gov.in (text extracted with pdftotext; OCR layer with minor artefacts):

- Clause 4: "The following expenses are not allowed to be part of the definition of 'associate medical expenses'. a. Cost of pharmacy and consumables; b. Cost of implants and medical devices c. Cost of diagnostics".
- Clause 6: no proportionate deduction where the hospital does not follow differential billing.
- Clause 7: "Insurers are not permitted to apply proportionate deduction for 'ICU charges'".
- Clause 8: applicable to products filed on or after 1 October 2020; existing non-compliant contracts "shall be modified as and when they are due for renewal from 01st April, 2021 onwards".

The 2019-20 Arogya Sanjeevani wording reduces "all other expenses … with the exception of cost of medicines", which on its face reaches implants and diagnostics. Whether the insurer modified this wording at renewal, and what the current version says, is not verified here. The circular itself was superseded on 29 May 2024 by the Master Circular on Health Insurance Business (Ref IRDAI/HLT/CIR/PRO/84/5/2024), which lists it as item 19 of Annexure-6; whether the same norm continues under the 2024 regime is not verified either. The engine therefore marks implants and diagnostics "requires insurer confirmation" with a range, and the question sheet asks the insurer in writing. Nothing in the product or the deck asserts how the insurer settles claims.

## Limits of this audit

Ten clauses of a 31-page wording are encoded; sub-limits, exclusions, waiting periods, non-payable items, pre- and post-hospitalisation, package rates and the sum-insured cap are not modelled and are listed as such on screen. The schedule and estimate are synthetic. This document checks the arithmetic and the clause reading; it is not a legal opinion and not an insurer's claim decision.
