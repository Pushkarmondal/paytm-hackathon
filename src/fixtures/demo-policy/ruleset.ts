import type { PolicyRuleset } from "@/engine/types";
import { DEMO_CLAUSES, DEMO_DOCUMENT, demoSource } from "./wording";

export const DEMO_FIXTURE_VERSION = "2026.10.24-1";

export const DEMO_RULESET: PolicyRuleset = {
  schemaVersion: "1",
  fixtureVersion: DEMO_FIXTURE_VERSION,
  metadata: {
    policyId: "demo-health-policy",
    name: "Claim Sach Demo Health Policy",
    issuer: {
      kind: "synthetic",
      label: "No insurer. Synthetic demo policy created for Claim Sach.",
    },
    wordingVersion: "1.0",
    effectiveDate: "2026-04-01",
    sourceDocument: {
      documentId: DEMO_DOCUMENT.documentId,
      title: DEMO_DOCUMENT.title,
    },
  },
  clauses: [...DEMO_CLAUSES],
  rules: {
    roomLimit: {
      ruleId: "C1.roomRentLimit",
      appliesTo: "room",
      basis: { kind: "percentOfSumInsuredPerDay", percent: 1 },
      source: demoSource("C1"),
    },
    icuLimit: {
      ruleId: "C2.icuLimit",
      appliesTo: "icu",
      basis: { kind: "percentOfSumInsuredPerDay", percent: 2 },
      source: demoSource("C2"),
    },
    proportionateDeduction: {
      ruleId: "C3.proportionateDeduction",
      affectedClass: "associatedMedicalExpenses",
      conditions: [
        {
          conditionId: "hospitalFollowsDifferentialBilling",
          description:
            "The Hospital follows differential billing based on room category.",
          resolvableBy: "hospital",
        },
      ],
      source: demoSource("C3"),
    },
    itemClasses: {
      ruleId: "C4.associatedMedicalExpenses",
      included: [
        "nursing",
        "surgeonFees",
        "anaesthetistFees",
        "consultantFees",
        "operationTheatre",
      ],
      excluded: ["pharmacyConsumables", "implant", "diagnostics", "icu"],
      source: demoSource("C4"),
    },
    sumInsuredCap: { ruleId: "C5.sumInsured", source: demoSource("C5") },
  },
};

/** The same wording with the proportionate-deduction clause removed: a policy that has no such rule. */
export const DEMO_RULESET_WITHOUT_DEDUCTION: PolicyRuleset = {
  ...DEMO_RULESET,
  metadata: {
    ...DEMO_RULESET.metadata,
    policyId: "demo-health-policy-no-deduction",
    name: "Claim Sach Demo Health Policy (variant without C3)",
  },
  clauses: DEMO_RULESET.clauses.filter((c) => c.id !== "C3"),
  rules: { ...DEMO_RULESET.rules, proportionateDeduction: undefined },
};
