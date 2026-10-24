/**
 * Arogya Sanjeevani Policy, The New India Assurance Co. Ltd.
 * UIN NIAHLIP20165V011920. A REAL, insurer-issued wording, hosted by IRDAI.
 *
 * Provenance: the PDF was downloaded from irdai.gov.in on 24 October 2026 and
 * its text extracted with pdftotext (poppler). Each clause below is the
 * extracted text of the numbered provision, with line breaks joined and runs
 * of spaces collapsed. Nothing else was changed. The SHA-256 of the PDF is in
 * VERIFICATION so anyone can re-check against the regulator's copy.
 *
 * This is a PARTIAL encoding: only the clauses listed in VERIFICATION are
 * encoded. Everything else in the 31-page wording is not modelled.
 */

import type { Clause, SourceRef, VerificationRecord } from "@/engine/types";

export const NIA_DOCUMENT = {
  documentId: "nia-arogya-sanjeevani-NIAHLIP20165V011920",
  title: "Arogya Sanjeevani Policy, The New India Assurance Co. Ltd. (policy clause, UIN NIAHLIP20165V011920)",
  version: "UIN NIAHLIP20165V011920, 2019-20 filing",
  url: "https://irdai.gov.in/documents/37343/931203/NIAHLIP20165V011920_2019-2020.pdf/73d50064-76a5-2d78-8299-858ce0690605?version=1.1&t=1668577518571&download=true",
} as const;

export const NIA_VERIFICATION: VerificationRecord = {
  url: NIA_DOCUMENT.url,
  sha256: "4e261c78014a210c3ba30aa813c820bfeb7751d153afd7e52e64be4d8f542d44",
  fetchedOn: "2026-10-24",
  pages: 31,
  extractedWith: "pdftotext (poppler), layout mode; line breaks joined, repeated spaces collapsed",
  encodedClauses: ["2", "3.11", "3.27", "3.47", "4.1(a)", "4.1(b)", "4.1(c)", "4.1(d)", "4.1.1 Note (b)", "9.5"],
  note: "Partial encoding of a real wording hosted by IRDAI. Only the listed clauses are encoded; the rest of the policy is not modelled. The policy schedule used with it in the demo is synthetic.",
};

export const NIA_CLAUSES: readonly Clause[] = [
  {
    id: "2",
    title: "Operative clause",
    page: 1,
    text: "If during the policy period one or more Insured Person (s) is required to be hospitalized for treatment of an Illness or Injury at a Hospital/ Day Care Centre, following Medical Advice of a duly qualified Medical Practitioner, the Company shall indemnify Medically necessary expenses towards the Coverage mentioned in the policy schedule. Provided further that, any amount payable under the policy shall be subject to the terms of coverage (including any co-pay, sub limits), exclusions, conditions and definitions contained herein. Maximum liability of the Company under all such Claims during each Policy Year shall be the Sum Insured (Individual or Floater) opted and Cumulative Bonus (if any) specified in the Schedule.",
  },
  {
    id: "3.11",
    title: "Definition: Co-payment",
    page: 2,
    text: "Co-payment means a cost sharing requirement under a health insurance policy that provides that the policyholder/insured will bear a specified percentage of the admissible claims amount. A co-payment does not reduce the Sum Insured.",
  },
  {
    id: "3.27",
    title: "Definition: ICU (Intensive Care Unit) Charges",
    page: 4,
    text: "ICU (Intensive Care Unit) Charges means the amount charged by a Hospital towards ICU expenses on a per day basis which shall include the expenses for ICU bed, general medical support services provided to any ICU patient including monitoring devices, critical care nursing and intensivist charges.",
  },
  {
    id: "3.47",
    title: "Definition: Room Rent",
    page: 6,
    text: "Room Rent means the amount charged by a hospital towards Room and Boarding expenses and shall include the associated medical expenses.",
  },
  {
    id: "4.1(a)",
    title: "Hospitalization: room rent, boarding, nursing",
    page: 7,
    text: "Room Rent, Boarding, Nursing Expenses as provided by the Hospital / Nursing Home up to 2% of the sum insured subject to maximum of Rs.5000/-, per day.",
  },
  {
    id: "4.1(b)",
    title: "Hospitalization: ICU / ICCU",
    page: 7,
    text: "Intensive Care Unit (ICU) / Intensive Cardiac Care Unit (ICCU) expenses up to 5% of sum insured subject to maximum of Rs.10,000/- per day.",
  },
  {
    id: "4.1(c)",
    title: "Hospitalization: professional fees",
    page: 7,
    text: "Surgeon, Anaesthetist, Medical Practitioner, Consultants, Specialist Fees whether paid directly to the treating doctor / surgeon or to the hospital.",
  },
  {
    id: "4.1(d)",
    title: "Hospitalization: other covered expenses",
    page: 7,
    text: "Anaesthesia, blood, oxygen, operation theatre charges, surgical appliances, medicines and drugs, costs towards diagnostics, diagnostic imaging modalities and such similar other expenses.",
  },
  {
    id: "4.1.1 Note (b)",
    title: "Proportionate payment when room or ICU rates exceed the limits",
    page: 7,
    text: "In case of admission to a room/ICU/ICCU at rates exceeding the aforesaid limits, the reimbursement/payment of all other expenses incurred at the Hospital, with the exception of cost of medicines, shall be effected in the same proportion as the admissible rate per day bears to the actual rate per day of Room Rent/ICU/ICCU charges.",
  },
  {
    id: "9.5",
    title: "Co-payment",
    page: 14,
    text: "Each and every claim under the Policy shall be subject to a Co-Payment of 5% applicable to claim amount admissible and payable as per the terms and conditions of the Policy. The amount payable shall be after deduction of the Co-Payment.",
  },
];

export function niaSource(clauseId: string): SourceRef {
  const clause = NIA_CLAUSES.find((c) => c.id === clauseId);
  if (!clause) throw new Error(`Unknown NIA clause ${clauseId}`);
  return {
    documentId: NIA_DOCUMENT.documentId,
    documentTitle: NIA_DOCUMENT.title,
    version: NIA_DOCUMENT.version,
    page: clause.page,
    clauseId: clause.id,
    quotedText: clause.text,
  };
}
