import { describe, expect, it } from "vitest";
import { classifyItems } from "@/engine/classify";
import { DEMO_ESTIMATE, DEMO_RULESET } from "@/fixtures/demo-policy";

const byId = (items: ReturnType<typeof classifyItems>) =>
  Object.fromEntries(items.map((i) => [i.itemId, i]));

describe("classifyItems: associated bill items follow the selected policy's own definition", () => {
  it("includes the categories the wording names as Associated Medical Expenses (C4)", () => {
    const items = byId(classifyItems(DEMO_RULESET, DEMO_ESTIMATE.items, {}));
    for (const id of ["nursing", "surgeon", "anaesthetist", "ot"]) {
      expect(items[id].classification).toBe("includedInDeduction");
      expect(items[id].classificationSource?.clauseId).toBe("C4");
      expect(items[id].classificationProvenance).toBe("fixture");
    }
  });

  it("keeps explicitly excluded categories out of the deduction (C4, C2)", () => {
    const items = byId(classifyItems(DEMO_RULESET, DEMO_ESTIMATE.items, {}));
    for (const id of ["implant", "pharmacy", "diagnostics"]) {
      expect(items[id].classification).toBe("excludedFromDeduction");
      expect(items[id].classificationSource?.clauseId).toBe("C4");
    }
    expect(items.icu.classification).toBe("icu");
    expect(items.icu.classificationSource?.clauseId).toBe("C4");
  });

  it("marks categories the wording does not mention as unknown, with no source", () => {
    const items = byId(classifyItems(DEMO_RULESET, DEMO_ESTIMATE.items, {}));
    expect(items.physio.classification).toBe("unknown");
    expect(items.physio.classificationSource).toBeNull();
    expect(items.admin.classification).toBe("unknown");
  });

  it("lets the user classify an unknown item, recorded as user-confirmed", () => {
    const items = byId(
      classifyItems(DEMO_RULESET, DEMO_ESTIMATE.items, {
        itemClassifications: { physio: "includedInDeduction" },
      }),
    );
    expect(items.physio.classification).toBe("includedInDeduction");
    expect(items.physio.classificationProvenance).toBe("userConfirmed");
    expect(items.physio.classificationSource).toBeNull();
  });

  it("never lets a user override what the policy itself defines", () => {
    const items = byId(
      classifyItems(DEMO_RULESET, DEMO_ESTIMATE.items, {
        itemClassifications: { implant: "includedInDeduction" },
      }),
    );
    expect(items.implant.classification).toBe("excludedFromDeduction");
    expect(items.implant.classificationProvenance).toBe("fixture");
  });

  it("classifies everything as unknown when the wording has no item-class definition", () => {
    const ruleset = { ...DEMO_RULESET, rules: { ...DEMO_RULESET.rules, itemClasses: undefined } };
    const items = classifyItems(ruleset, DEMO_ESTIMATE.items, {});
    for (const item of items) {
      if (item.category === "icu") continue;
      expect(item.classification).toBe("unknown");
    }
  });
});
