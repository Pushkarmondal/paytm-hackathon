import { rupees } from "@/engine/money";
import type { PolicyRuleset, PolicySchedule } from "@/engine/types";
import { NIA_CLAUSES, NIA_DOCUMENT, NIA_VERIFICATION, niaSource } from "./wording";

export const NIA_FIXTURE_VERSION = "2026.10.24-1";

export const NIA_RULESET: PolicyRuleset = {
  schemaVersion: "1",
  fixtureVersion: NIA_FIXTURE_VERSION,
  metadata: {
    policyId: "nia-arogya-sanjeevani-2019",
    name: "Arogya Sanjeevani Policy, The New India Assurance Co. Ltd.",
    issuer: { kind: "insurer", name: "The New India Assurance Co. Ltd.", uin: "NIAHLIP20165V011920", sourceUrl: NIA_DOCUMENT.url },
    wordingVersion: NIA_DOCUMENT.version,
    effectiveDate: "2019-20 filing (effective date not stated on the extracted pages)",
    sourceDocument: { documentId: NIA_DOCUMENT.documentId, title: NIA_DOCUMENT.title, url: NIA_DOCUMENT.url },
    verification: NIA_VERIFICATION,
  },
  clauses: [...NIA_CLAUSES],
  rules: {
    roomLimit: {
      ruleId: "4.1(a).roomRentLimit",
      appliesTo: "room",
      basis: { kind: "percentOfSumInsuredPerDay", percent: 2, capPerDay: rupees(5_000) },
      source: niaSource("4.1(a)"),
    },
    icuLimit: {
      ruleId: "4.1(b).icuLimit",
      appliesTo: "icu",
      basis: { kind: "percentOfSumInsuredPerDay", percent: 5, capPerDay: rupees(10_000) },
      source: niaSource("4.1(b)"),
    },
    proportionateDeduction: {
      ruleId: "4.1.1(b).proportionatePayment",
      affectedClass: "associatedMedicalExpenses",
      conditions: [],
      triggers: ["room", "icu"],
      source: niaSource("4.1.1 Note (b)"),
    },
    itemClasses: {
      ruleId: "4.1.1(b).allOtherExpensesExceptMedicines",
      included: ["nursing", "surgeonFees", "anaesthetistFees", "consultantFees", "operationTheatre", "implant", "diagnostics", "physiotherapy"],
      excluded: [],
      notes: {
        pharmacyConsumables: "the wording excepts the cost of medicines from the proportionate payment but says nothing about consumables, and this line mixes the two",
        hospitalAdmin: "the wording speaks of expenses incurred at the Hospital; whether an administrative charge is a covered expense at all is not stated",
      },
      source: niaSource("4.1.1 Note (b)"),
    },
    copay: { ruleId: "9.5.copay", percent: 5, source: niaSource("9.5") },
    sumInsuredCap: { ruleId: "2.sumInsuredCap", source: niaSource("2") },
  },
  caveats: [
    {
      code: "WORDING_PREDATES_2020_NORMS",
      text: "This wording (2019-20 filing) reduces all other hospital expenses except medicines, which includes implants and diagnostics. IRDAI's circular of 11 June 2020 (IRDAI/HLT/REG/CIR/151/06/2020) barred proportionate deductions on implants, medical devices, diagnostics and pharmacy and consumables for products filed from 1 October 2020, and required existing contracts to be modified at renewal from 1 April 2021. Whether the insurer still applies the reduction to these items requires insurer confirmation.",
      affectedCategories: ["implant", "diagnostics"],
      resolvableBy: "insurer",
      whatWouldResolveIt: "Ask the insurer in writing whether, under the current version of this policy, the proportionate reduction applies to implants and diagnostics.",
    },
  ],
  notices: [
    {
      code: "POLICY_CAVEAT",
      text: "Under 4.1(a) the room-rent limit covers room, boarding and nursing together. This estimate lists nursing as a separate line, so the per-day comparison uses the room rate alone and may understate the amount above the limit by the nursing rate.",
      affectedCategories: ["nursing"],
      resolvableBy: "user",
      whatWouldResolveIt: "Enter the hospital's combined room, boarding and nursing rate per day as the room rate on the Coverage Twin.",
    },
  ],
};

/** A SYNTHETIC schedule for the demo. Real schedules are personal documents and are never bundled. */
export const NIA_DEMO_SCHEDULE: PolicySchedule = {
  scheduleId: "DEMO-SCH-AS-0001",
  policyId: "nia-arogya-sanjeevani-2019",
  sumInsured: rupees(500_000),
  insuredLabel: "Demo Insured (synthetic schedule used with a real wording)",
  policyPeriod: { from: "2026-04-01", to: "2027-03-31" },
  provenance: "fixture",
};
