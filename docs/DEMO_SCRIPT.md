# Claim Sach: three-minute demo script

Judge-facing. Exact clicks, what to say, and the fallbacks. Rehearse three full times before Saturday 31 October 2026.

## Before the slot

1. Laptop on mains, display at 100% zoom, browser at full width, notifications off.
2. Build and start the production server while still online, then switch Wi-Fi off and reload once to prove it:
   ```bash
   npm run build && npm start
   ```
3. Open http://localhost:3000. Click **Reset to demo**. The header must read "Synthetic demo policy" and "Uncertain 3".
4. Keep the recording (see Fallbacks) on the desktop.

## The script

| Time | Click | Say |
|---|---|---|
| 0:00 | Nothing yet. The **Scenario overview** is on screen. | "One synthetic policy, one hospital estimate, one planned room. The headline is the potential deductions covered by this simulation: ₹15,000 calculated, ₹0 to ₹38,000 conditional, ₹7,500 not classified. Not a total, and it says so." Point at the sub-line. |
| 0:25 | **Open Coverage Twin** | "Same policy, same estimate, two rooms. A is twin-sharing at ₹4,500 a day, within the ₹5,000 limit. B is the single private room at ₹7,500. The amber rows are what changed: room rent above the limit, and the four associated items. Implant, pharmacy and diagnostics are not subject to the deduction, and the wording says why." |
| 0:55 | Click the **Surgeon fees** amount in column B | "Every number opens its own evidence. Clause C3, quoted. Inputs with where they came from. The formula: ₹60,000 × (1 − 5,000 ÷ 7,500). The result is a range because the estimate does not say whether this hospital bills differently by room category, and the clause applies only if it does." Press **Close**. |
| 1:20 | Click the **Room rent** amount in column B | "This one is calculated: ₹2,500 a day above the limit, four days, ₹10,000, clause C1." Press **Close**. |
| 1:35 | Tab **What remains uncertain** | "Nothing here is hidden in a total. Ask the hospital: differential billing, ₹0 to ₹38,000 at stake. Requires insurer confirmation: the wording is silent on a forced upgrade. You can resolve now: two items the wording does not classify. And the list of what this version does not model at all." |
| 2:05 | Press **Resolve on Input review**, set **Hospital follows differential billing** to **Yes, confirmed by me** | "The hospital confirmed. Watch the provenance." Tab **Coverage Twin**. "Column B is now ₹53,000 calculated. Every trace says 'confirmed by you' on that input." |
| 2:30 | In **B · Planned room**, choose **Deluxe room** | "Change your room. See the difference. Ratio 5 ÷ 12, ₹94,500 from the room choice, ₹99,500 in all. Why this changed names the clause for every row." Optionally tab **Why this changed**. |
| 2:50 | **Reset to demo** | "Every number you saw has a clause behind it. Everything we could not establish, and everything this version does not model, is on that panel, not hidden in a total." |

If the slot allows a fourth minute, or a judge asks "does it work on a real policy":

| Time | Click | Say |
|---|---|---|
| 3:00 | On the overview, switch the **Policy** select to **Arogya Sanjeevani, The New India Assurance** | "A real wording, IRDAI's standard product, downloaded from the regulator's site, ten clauses quoted verbatim, checksum on screen. Under this wording the ₹15,000 ICU day alone triggers the proportion, and implants and diagnostics become ranges: this 2019-20 wording reduces them, IRDAI's 2020 norms later barred that, so the engine says 'requires insurer confirmation' instead of guessing." |
| 3:30 | Tab **Ruleset builder** | "This is where the model is allowed to help: it proposes rules with quotes, the engine checks every quote verbatim, I confirm. Two proposals are flagged as differing from the reviewed ruleset, and that is the point." Confirm three, press **Apply**. |
| 3:55 | **Reset to demo** | |

## The two cases

- **Valid calculation:** the room rent limit (C1) and, once differential billing is confirmed, the proportionate deduction (C3) on the four associated items.
- **Ambiguous case the engine refuses to overstate:** before confirmation the deduction is a range with both bounds traced; the two unclassified items never enter a total; the forced-upgrade question is marked as requiring insurer confirmation. If a judge asks for more: on Input review, pick **Policy schedule missing** and show the headline turn into "cannot be determined" with dashes where numbers were.

## Likely questions

- *Is this a real policy?* No. It is a synthetic wording, labelled as such everywhere. A real wording is loaded as a ruleset through Input review, and every rule must quote its clause exactly or it is refused.
- *Does it guarantee the payout?* No. The footer says it: a scenario estimate of the deductions this simulation covers, not a claim decision.
- *Where is the AI?* In the Ruleset builder: a model proposes rules from a public wording with verbatim quotes, the engine verifies every quote, a person confirms. The calculation stays deterministic on purpose. The proposals shown are cached; the live adapter is off and was not exercised. The demo needs no key.
- *Is that a real policy?* Yes: Arogya Sanjeevani, The New India Assurance Co. Ltd., UIN NIAHLIP20165V011920, from irdai.gov.in, partially encoded, checksum and page numbers on Input review. The schedule with it is synthetic.
- *Which room should I take?* The room ladder on the overview marks the highest room within the limit and shows the deductions at every room. The product does not recommend; it shows.
- *How accurate is it?* `docs/EVALUATION-RESULTS.md`: measured on the synthetic wording only, with the dataset sizes printed beside each number.

## Fallbacks, in order

1. The production server (`npm start`) on localhost, Wi-Fi off. Everything is in the bundle; fonts are bundled.
2. The dev server: `npm run dev`.
3. A screen recording of the same sequence, made on Friday 30 October, played from the laptop.

## Reset

**Reset to demo** in the header clears every edit, confirmation and upload and reloads the fixture. Press it before each judge.
