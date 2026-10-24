import { rupees } from "@/engine/money";
import type { PolicySchedule, SourceRef } from "@/engine/types";

const SCHEDULE_DOCUMENT = {
  documentId: "demo-schedule-0001",
  documentTitle: "Policy Schedule DEMO-SCH-0001 (synthetic)",
  version: "1",
} as const;

function scheduleSource(quotedText: string): SourceRef {
  return { ...SCHEDULE_DOCUMENT, page: 1, clauseId: "schedule", quotedText };
}

export const DEMO_SCHEDULE: PolicySchedule = {
  scheduleId: "DEMO-SCH-0001",
  policyId: "demo-health-policy",
  sumInsured: rupees(500_000),
  insuredLabel: "Demo Insured (synthetic)",
  policyPeriod: { from: "2026-04-01", to: "2027-03-31" },
  roomLimitPerDay: {
    amountPerDay: rupees(5_000),
    source: scheduleSource(
      "Room rent limit: 1% of Sum Insured per day (Rs. 5,000 per day).",
    ),
  },
  icuLimitPerDay: {
    amountPerDay: rupees(10_000),
    source: scheduleSource(
      "ICU limit: 2% of Sum Insured per day (Rs. 10,000 per day).",
    ),
  },
  provenance: "fixture",
};

/** A schedule whose printed room limit disagrees with the wording's 1% rule. Used to test the review-required state. */
export const DEMO_SCHEDULE_CONTRADICTORY: PolicySchedule = {
  ...DEMO_SCHEDULE,
  scheduleId: "DEMO-SCH-CONTRA",
  roomLimitPerDay: {
    amountPerDay: rupees(6_000),
    source: scheduleSource("Room rent limit: Rs. 6,000 per day."),
  },
};
