import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import { questionSheet, questionSheetText } from "@/model/questions";
import { arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { SCENARIO_SINGLE, SCENARIO_TWIN, demoInputs } from "@/fixtures/demo-policy";

describe("question sheet: what to ask the hospital and the insurer, tied to clauses and rupees", () => {
  const sheet = questionSheet(evaluate(demoInputs(), SCENARIO_SINGLE));

  it("asks the hospital about differential billing, with the clause and the amount at stake", () => {
    expect(sheet.hospital).toHaveLength(1);
    expect(sheet.hospital[0].question).toMatch(/differential/i);
    expect(sheet.hospital[0].clauseId).toBe("C3");
    expect(sheet.hospital[0].atStake).toEqual({ low: 0, high: rupees(38_000), basis: expect.any(String) });
  });

  it("asks the insurer about what the wording leaves open", () => {
    const codes = sheet.insurer.map((q) => q.code);
    expect(codes).toContain("WORDING_SILENT_ON_ROOM_UNAVAILABILITY");
    expect(codes).toContain("ITEM_NOT_CLASSIFIED");
    expect(sheet.insurer.find((q) => q.code === "ITEM_NOT_CLASSIFIED")?.question).toMatch(/Physiotherapy/);
  });

  it("lists what the user can settle now", () => {
    expect(sheet.you.map((q) => q.code)).toEqual(["ITEM_NOT_CLASSIFIED"]);
  });

  it("renders as plain text with the three headings and the disclaimer", () => {
    const text = questionSheetText(sheet, evaluate(demoInputs(), SCENARIO_SINGLE));
    expect(text).toContain("Ask the hospital");
    expect(text).toContain("Ask the insurer");
    expect(text).toContain("For you");
    expect(text).toContain("₹0 to ₹38,000");
    expect(text).toMatch(/not a guarantee/i);
  });

  it("is empty for the hospital once differential billing is confirmed", () => {
    const s = questionSheet(evaluate({ ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } }, SCENARIO_SINGLE));
    expect(s.hospital).toHaveLength(0);
  });

  it("on the real wording, asks the insurer about the 2020 norms and the ICU ratio, and asks the hospital for the combined nursing rate", () => {
    const s = questionSheet(evaluate(arogyaInputs(), SCENARIO_TWIN));
    expect(s.insurer.map((q) => q.code)).toContain("WORDING_PREDATES_2020_NORMS");
    expect(s.hospital.map((q) => q.code)).toContain("POLICY_CAVEAT");
  });
});
