import { describe, expect, it } from "vitest";
import { rupees } from "@/engine/money";
import { parseEstimateCsv, parseEstimateJson, parseRulesetJson, parseScheduleJson, readUpload } from "@/ingestion";
import { DEMO_ESTIMATE, DEMO_RULESET, DEMO_SCHEDULE } from "@/fixtures/demo-policy";

describe("ruleset JSON: the engine's own shape, validated, with evidence cross-checked", () => {
  it("accepts the demo ruleset round-tripped through JSON and marks it as uploaded", () => {
    const r = parseRulesetJson(JSON.stringify(DEMO_RULESET));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.metadata.policyId).toBe("demo-health-policy");
      expect(r.value.rules.proportionateDeduction?.source.clauseId).toBe("C3");
      expect(r.provenance).toBe("upload");
    }
  });

  it("rejects malformed JSON with a clear message, never an exception", () => {
    const r = parseRulesetJson("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MALFORMED_JSON");
  });

  it("rejects a ruleset whose shape is wrong and names the path", () => {
    const bad = { ...DEMO_RULESET, rules: { ...DEMO_RULESET.rules, roomLimit: { ...DEMO_RULESET.rules.roomLimit, basis: { kind: "nonsense" } } } };
    const r = parseRulesetJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.message).toContain("rules.roomLimit.basis");
    }
  });

  it("rejects a rule whose quoted source text is not in the wording's clauses", () => {
    const bad = {
      ...DEMO_RULESET,
      rules: { ...DEMO_RULESET.rules, roomLimit: { ...DEMO_RULESET.rules.roomLimit, source: { ...DEMO_RULESET.rules.roomLimit!.source, quotedText: "something the wording never says" } } },
    };
    const r = parseRulesetJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("EVIDENCE");
  });

  it("rejects non-integer money", () => {
    const bad = { ...DEMO_RULESET, rules: { ...DEMO_RULESET.rules, roomLimit: { ...DEMO_RULESET.rules.roomLimit, basis: { kind: "fixedPerDay", amount: 500000.5 } } } };
    const r = parseRulesetJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });

  it("requires an insurer-issued ruleset to carry a source URL, so provenance is never implied", () => {
    const bad = { ...DEMO_RULESET, metadata: { ...DEMO_RULESET.metadata, issuer: { kind: "insurer", name: "Example" } } };
    const r = parseRulesetJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});

describe("schedule and estimate JSON", () => {
  it("accepts the demo schedule and estimate", () => {
    const s = parseScheduleJson(JSON.stringify(DEMO_SCHEDULE));
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.value.sumInsured).toBe(rupees(500_000));
      expect(s.value.provenance).toBe("upload");
    }
    const e = parseEstimateJson(JSON.stringify(DEMO_ESTIMATE));
    expect(e.ok).toBe(true);
    if (e.ok) {
      expect(e.value.items).toHaveLength(10);
      expect(e.value.provenance).toBe("upload");
    }
  });

  it("rejects an estimate that selects no room options or has duplicate item ids", () => {
    const noRooms = parseEstimateJson(JSON.stringify({ ...DEMO_ESTIMATE, roomOptions: [] }));
    expect(noRooms.ok).toBe(false);
    const dup = parseEstimateJson(JSON.stringify({ ...DEMO_ESTIMATE, items: [DEMO_ESTIMATE.items[0], DEMO_ESTIMATE.items[0]] }));
    expect(dup.ok).toBe(false);
  });
});

describe("estimate CSV: line items in rupees, reviewed before use", () => {
  const csv = [
    "label,category,amount_rupees,days,rate_per_day_rupees",
    "ICU 1 day,icu,15000,1,15000",
    "Nursing,nursing,4000,,",
    "Surgeon,surgeonFees,60000,,",
    "Implant,implant,120000.00,,",
    "Physio,physiotherapy,6000,,",
    "Something odd,mystery,1500,,",
  ].join("\n");

  it("parses rupees to paise exactly and keeps per-day detail", () => {
    const r = parseEstimateCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items.map((i) => i.amount)).toEqual([rupees(15_000), rupees(4_000), rupees(60_000), rupees(120_000), rupees(6_000), rupees(1_500)]);
    expect(r.value.items[0].perDay).toEqual({ days: 1, ratePerDay: rupees(15_000) });
    expect(r.value.items[1].perDay).toBeUndefined();
    expect(r.value.items.map((i) => i.itemId)).toEqual(["line-1", "line-2", "line-3", "line-4", "line-5", "line-6"]);
  });

  it("maps an unknown category to other, with a warning the review screen shows", () => {
    const r = parseEstimateCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.items[5].category).toBe("other");
    expect(r.warnings.join(" ")).toMatch(/mystery/);
  });

  it("rejects a missing header, a bad amount and fractions of a paisa", () => {
    expect(parseEstimateCsv("Nursing,nursing,4000").ok).toBe(false);
    const bad = parseEstimateCsv("label,category,amount_rupees\nNursing,nursing,four thousand");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.message).toMatch(/line 2/);
    expect(parseEstimateCsv("label,category,amount_rupees\nNursing,nursing,4000.005").ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(parseEstimateCsv("label,category,amount_rupees\n").ok).toBe(false);
  });
});

describe("readUpload: the one entry point for files, failing safely", () => {
  it("rejects files over the size limit before reading them", () => {
    const r = readUpload({ name: "big.json", size: 6 * 1024 * 1024, text: "{}" }, "ruleset");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TOO_LARGE");
  });

  it("rejects unsupported file types by extension, not by trusting the declared type", () => {
    const r = readUpload({ name: "policy.pdf", size: 10, text: "%PDF-1.4" }, "ruleset");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_TYPE");
    expect(readUpload({ name: "policy.exe", size: 10, text: "" }, "estimate").ok).toBe(false);
  });

  it("routes CSV to the estimate parser and JSON to the typed parser", () => {
    const e = readUpload({ name: "bill.csv", size: 50, text: "label,category,amount_rupees\nNursing,nursing,4000" }, "estimate");
    expect(e.ok).toBe(true);
    if (e.ok && e.kind === "estimateItems") expect(e.value.items[0].amount).toBe(rupees(4_000));
    const s = readUpload({ name: "schedule.json", size: 50, text: JSON.stringify(DEMO_SCHEDULE) }, "schedule");
    expect(s.ok).toBe(true);
    const r = readUpload({ name: "wording.csv", size: 50, text: "a,b" }, "ruleset");
    expect(r.ok).toBe(false);
  });

  it("never throws on garbage", () => {
    expect(() => readUpload({ name: "x.json", size: 3, text: "\u0000\u0001" }, "ruleset")).not.toThrow();
    expect(readUpload({ name: "x.json", size: 3, text: "\u0000\u0001" }, "ruleset").ok).toBe(false);
  });
});
