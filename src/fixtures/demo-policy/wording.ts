/**
 * Claim Sach Demo Health Policy, wording v1.0.
 *
 * SYNTHETIC. Not issued by any insurer. Invented for the Coverage Twin demo.
 * The clause structure follows what IRDAI's 2020 norms on proportionate
 * deductions required of real policies (a defined "Associated Medical
 * Expenses" class; pharmacy and consumables, implants and devices,
 * diagnostics and ICU kept out of it; a differential-billing condition).
 * Those norms were superseded on 29 May 2024; see docs/PRD.md Appendix B.
 */

import type { Clause, SourceRef } from "@/engine/types";

export const DEMO_DOCUMENT = {
  documentId: "demo-policy-wording-v1",
  title: "Claim Sach Demo Health Policy, wording v1.0 (synthetic)",
  version: "1.0",
} as const;

export const DEMO_CLAUSES: readonly Clause[] = [
  {
    id: "C5",
    title: "Sum Insured",
    page: 1,
    text: "The Company's total liability for all claims in a Policy Year shall not exceed the Sum Insured stated in the Policy Schedule.",
  },
  {
    id: "C1",
    title: "Room rent limit",
    page: 2,
    text: "Room rent and boarding charges incurred during Hospitalisation are payable up to 1% of the Sum Insured per day, as stated in the Policy Schedule.",
  },
  {
    id: "C2",
    title: "ICU charges",
    page: 2,
    text: "Intensive Care Unit (ICU) charges are payable up to 2% of the Sum Insured per day. The proportionate deduction in Clause C3 does not apply to ICU charges.",
  },
  {
    id: "C3",
    title: "Proportionate deduction",
    page: 3,
    text: "If the Insured Person occupies a room whose rent exceeds the limit in Clause C1, the Company shall pay the Associated Medical Expenses in the same proportion as the eligible room rent bears to the room rent actually incurred. This deduction applies only where the Hospital follows differential billing based on room category.",
  },
  {
    id: "C4",
    title: "Associated Medical Expenses",
    page: 3,
    text: "Associated Medical Expenses means nursing charges; fees of the surgeon, anaesthetist, medical practitioner and consultants; and operation theatre charges. Associated Medical Expenses do not include the cost of pharmacy and consumables, implants and medical devices, diagnostics, or ICU charges.",
  },
];

export function demoSource(clauseId: string): SourceRef {
  const clause = DEMO_CLAUSES.find((c) => c.id === clauseId);
  if (!clause) {
    throw new Error(`Unknown demo clause ${clauseId}`);
  }
  return {
    documentId: DEMO_DOCUMENT.documentId,
    documentTitle: DEMO_DOCUMENT.title,
    version: DEMO_DOCUMENT.version,
    page: clause.page,
    clauseId: clause.id,
    quotedText: clause.text,
  };
}
