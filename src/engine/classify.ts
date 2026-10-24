import type {
  BillItem,
  ClassifiedItem,
  Confirmations,
  PolicyRuleset,
  Provenance,
} from "./types";

/**
 * Classifies estimate lines by the selected policy's own definition of the
 * expenses the proportionate deduction touches. Categories the wording does
 * not mention are unknown. The user may classify an unknown line (recorded as
 * user-confirmed) but can never override what the policy defines.
 */
export function classifyItems(
  ruleset: PolicyRuleset,
  items: readonly BillItem[],
  confirmations: Confirmations,
  rulesetProvenance: Provenance = "fixture",
): ClassifiedItem[] {
  const definition = ruleset.rules.itemClasses;
  return items.map((item): ClassifiedItem => {
    if (item.category === "roomRent") {
      return {
        ...item,
        classification: "roomRent",
        classificationSource: ruleset.rules.roomLimit?.source ?? null,
        classificationProvenance: rulesetProvenance,
      };
    }
    if (item.category === "icu") {
      return {
        ...item,
        classification: "icu",
        classificationSource: definition?.source ?? ruleset.rules.icuLimit?.source ?? null,
        classificationProvenance: rulesetProvenance,
      };
    }
    if (definition?.included.includes(item.category)) {
      return {
        ...item,
        classification: "includedInDeduction",
        classificationSource: definition.source,
        classificationProvenance: rulesetProvenance,
      };
    }
    if (definition?.excluded.includes(item.category)) {
      return {
        ...item,
        classification: "excludedFromDeduction",
        classificationSource: definition.source,
        classificationProvenance: rulesetProvenance,
      };
    }
    const override = confirmations.itemClassifications?.[item.itemId];
    if (override) {
      return {
        ...item,
        classification: override,
        classificationSource: null,
        classificationProvenance: "userConfirmed",
      };
    }
    return {
      ...item,
      classification: "unknown",
      classificationSource: null,
      classificationProvenance: rulesetProvenance,
    };
  });
}
