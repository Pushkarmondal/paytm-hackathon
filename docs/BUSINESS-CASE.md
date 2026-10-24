# Claim Sach: business case, sourced

What is verified, what is a hypothesis, how each hypothesis would be tested, and what would make the case strong enough to believe. Written 24 October 2026.

## 1. Verified facts

Each line names its source. Nothing else in this document is a fact.

**Paytm** (verified by the planning session from primary filings; see `docs/PRD.md` §13 and Appendix C):

- Paytm Insurance Broking Private Limited holds an IRDAI Direct (Life & General) broker licence, Registration No. 700, renewed 9 February 2026, valid to 16 February 2029.
- It distributes car, two-wheeler, health, life and term policies from 18 or more insurers, including Niva Bupa and Aditya Birla Health. It does not underwrite.
- It already offers claim assistance by phone.
- FY25 turnover ₹37.1 crore with a ₹13.2 crore loss (Form AOC-1, One 97 Communications Annual Report FY25), inside a financial-services line of ₹2,593 crore in FY26. Insurance is a small line for Paytm today.
- Paytm Intelligence ("Pi", announced September 2026, press reports) includes a claim-credibility model.

**Regulation** (verified in this build from PDFs on irdai.gov.in; see `docs/PRD.md` Appendix B):

- IRDAI's circular of 11 June 2020 (IRDAI/HLT/REG/CIR/151/06/2020) required insurers using proportionate deductions to define "associate medical expenses", barred pharmacy and consumables, implants and medical devices, and diagnostics from that definition, barred the deduction where the hospital does not follow differential billing, and barred it on ICU charges, for products filed from 1 October 2020, with existing contracts to be modified at renewal from 1 April 2021.
- IRDAI's Master Circular on Health Insurance Business (IRDAI/HLT/CIR/PRO/84/5/2024, 29 May 2024) supersedes that circular and, in its Customer Information Sheet template, requires sub-limits such as "Room / ICU charges beyond ____" and co-payments to be disclosed to the customer.
- Arogya Sanjeevani, IRDAI's standard health product, is sold by many insurers on one wording with a room-rent limit of 2% of the sum insured up to ₹5,000 a day, an ICU limit of 5% up to ₹10,000 a day, a proportionate payment of all other expenses except medicines when either rate is exceeded, and a 5% co-payment (verified in The New India Assurance Co. Ltd.'s filed wording, UIN NIAHLIP20165V011920, hosted by IRDAI; encoded in this product).

**This product** (verified by its own tests and harness): deterministic deductions on both a synthetic wording and the ten encoded clauses of a real one, with every amount traceable to a clause; see `docs/EVALUATION-RESULTS.md`.

## 2. Secondary figures, not yet verified

These come from press reports of the Council for Insurance Ombudsmen's annual report for 2023-24. They must be read from the report itself (cioins.co.in, Annual Report 2023-24, a PDF this build could not fetch within its tool limits) before any of them appears on a slide:

- Health-insurance complaints to the Ombudsman rose to about 31,490 in 2023-24 from about 25,873 the year before (press reports).
- A large majority of complaints, reported as about 95%, fell under Rule 13(1)(b) of the Insurance Ombudsman Rules, which covers partial or total repudiation of claims (press reports).

If the report confirms them, the point they make is narrow and useful: the dominant complaint is about what was paid, after the fact. Claim Sach works on the moment before that.

## 3. The hypotheses and their tests

| # | Hypothesis | Test | Pass | Kill |
|---|---|---|---|---|
| H1 | Policyholders who run a pre-admission check contact claim assistance less often at claim time, and dispute less | Four-week pilot at one broker claim-assistance desk; agents on alternate days use Claim Sach on calls about planned admissions; count repeat contacts per claim and disputes per claim in each arm | Fewer repeat contacts per claim in the Claim Sach arm over at least 200 calls | No difference after 200 calls |
| H2 | Shown the item-level consequence, people choose a room within their limit more often | Room-change rate inside the simulator (the room ladder makes it one click); then, in the pilot, the share of claims that carried a room-rent deduction | Measurable room-change rate and a lower deduction share in the pilot arm | No change in either |
| H3 | Panel insurers will co-fund or co-brand a coverage-clarity tool as a distribution-quality signal | Three conversations with panel insurers after the hackathon, with the Arogya Sanjeevani demo | One signed pilot letter | Three polite noes |
| H4 | A coverage check on the policy page lifts conversion or renewal on the Paytm app | An A/B test on the policy page, if Paytm chooses to run one | Any lift at significance | Flat |

Revenue depends on which hypothesis survives: a broker-side feature (retention and renewal, no direct charge), an insurer-paid integration, or a premium claim-assistance tier. None is asserted. Bima Sugam is not live (IRDAI's estimate: November 2026) and belongs in the future tense.

## 4. Unit economics from verified inputs only

- Serving one check costs nothing beyond hosting: the calculation runs in the browser, there is no database and no model call in the core path. Hosting on a free tier is ₹0; a paid tier is a fixed cost, not per check.
- Encoding one wording: in this build, the Arogya Sanjeevani clauses took one session to fetch, verify, encode and test, with the ruleset builder proposing six rules of which four agreed with the human-reviewed ruleset outright and two needed narrowing (`docs/EVALUATION-RESULTS.md`). Time per wording for a trained reviewer is an **assumption** until measured on a second wording.
- The backlog: Paytm's panel of 18 or more insurers sells many products each; the number of distinct wordings to encode is unknown and is the first thing to count in a pilot.

## 5. What would make this a 9

One real conversation, which only Pushkar can have: a broker claim-assistance desk willing to run the four-week pilot, or an insurer willing to let its wording be encoded and shown. The product is ready for either today.

## 6. Outreach note

> I am building Claim Sach, a health-insurance coverage simulator for the moment before admission: it applies a policy's own wording to a hospital estimate and shows, item by item and clause by clause, what the policy might leave the patient paying, and what it cannot determine without asking the hospital or the insurer. It runs on IRDAI's standard Arogya Sanjeevani wording today. I would like thirty minutes to show it to your claim-assistance team and to ask whether a four-week pilot on planned-admission calls makes sense. There is nothing to install and no data leaves the browser.
