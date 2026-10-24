import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { rupees } from "@/engine/money";
import {
  DEMO_VARIANTS,
  POLICY_OPTIONS,
  proposalsFor,
  buildInputs,
  groupUncertainties,
  headlineFor,
  initialState,
  reduce,
  scenarioFor,
  stateLabel,
} from "@/model";
import { DEMO_ESTIMATE, DEMO_RULESET, DEMO_SCHEDULE, ROOM_DELUXE, ROOM_SINGLE, ROOM_TWIN, SCENARIO_SINGLE, demoInputs } from "@/fixtures/demo-policy";

describe("app state: the demo opens ready, and every edit is a reducer action", () => {
  it("opens on the overview with the single private room planned and twin-sharing as the comparison", () => {
    const s = initialState();
    expect(s.screen).toBe("overview");
    expect(s.variant).toBe("standard");
    expect(s.plannedRoom).toEqual({ roomId: ROOM_SINGLE });
    expect(s.comparisonRoom).toEqual({ roomId: ROOM_TWIN });
    expect(s.confirmations).toEqual({});
    expect(s.openTrace).toBeNull();
  });

  it("changes the planned room and clears a custom rate when the room changes", () => {
    let s = reduce(initialState(), { type: "setRate", side: "planned", ratePerDay: rupees(10_000) });
    expect(s.plannedRoom).toEqual({ roomId: ROOM_SINGLE, ratePerDay: rupees(10_000) });
    s = reduce(s, { type: "selectRoom", side: "planned", roomId: ROOM_DELUXE });
    expect(s.plannedRoom).toEqual({ roomId: ROOM_DELUXE });
  });

  it("records confirmations and item classifications", () => {
    let s = reduce(initialState(), { type: "confirmDifferentialBilling", value: true });
    expect(s.confirmations.hospitalFollowsDifferentialBilling).toBe(true);
    s = reduce(s, { type: "classifyItem", itemId: "physio", classification: "includedInDeduction" });
    expect(s.confirmations.itemClassifications).toEqual({ physio: "includedInDeduction" });
    s = reduce(s, { type: "classifyItem", itemId: "physio", classification: null });
    expect(s.confirmations.itemClassifications).toEqual({});
    s = reduce(s, { type: "confirmDifferentialBilling", value: null });
    expect(s.confirmations.hospitalFollowsDifferentialBilling).toBeUndefined();
  });

  it("switches screens and opens or closes a trace", () => {
    const trace = evaluate(demoInputs(), SCENARIO_SINGLE).roomLimit.trace!;
    let s = reduce(initialState(), { type: "setScreen", screen: "twin" });
    expect(s.screen).toBe("twin");
    s = reduce(s, { type: "openTrace", title: "Room rent limit", trace });
    expect(s.openTrace?.title).toBe("Room rent limit");
    s = reduce(s, { type: "closeTrace" });
    expect(s.openTrace).toBeNull();
  });

  it("resets everything to the demo state", () => {
    let s = reduce(initialState(), { type: "confirmDifferentialBilling", value: true });
    s = reduce(s, { type: "setVariant", variant: "scheduleMissing" });
    s = reduce(s, { type: "selectRoom", side: "planned", roomId: ROOM_DELUXE });
    s = reduce(s, { type: "reset" });
    expect(s).toEqual(initialState());
  });
});

describe("buildInputs: demo variants and edits become engine inputs", () => {
  it("builds the standard case from the fixture", () => {
    const s = initialState();
    const inputs = buildInputs(s);
    expect(inputs.schedule?.scheduleId).toBe("DEMO-SCH-0001");
    expect(inputs.ruleset.rules.proportionateDeduction).toBeDefined();
    expect(inputs.estimate.differentialBilling).toBe("notStated");
  });

  it("removes the schedule, contradicts it, or drops the deduction clause per variant", () => {
    expect(buildInputs(reduce(initialState(), { type: "setVariant", variant: "scheduleMissing" })).schedule).toBeNull();
    expect(
      buildInputs(reduce(initialState(), { type: "setVariant", variant: "scheduleContradictory" })).schedule?.roomLimitPerDay?.amountPerDay,
    ).toBe(rupees(6_000));
    expect(
      buildInputs(reduce(initialState(), { type: "setVariant", variant: "noDeductionClause" })).ruleset.rules.proportionateDeduction,
    ).toBeUndefined();
    expect(DEMO_VARIANTS.map((v) => v.id)).toEqual(["standard", "scheduleMissing", "scheduleContradictory", "noDeductionClause"]);
  });

  it("applies edits to room days and the sum insured as user-entered values", () => {
    let s = reduce(initialState(), { type: "setRoomDays", days: 5 });
    s = reduce(s, { type: "setSumInsured", sumInsured: rupees(1_000_000) });
    const inputs = buildInputs(s);
    expect(inputs.estimate.roomDays).toBe(5);
    expect(inputs.estimate.provenance).toBe("userEntered");
    expect(inputs.schedule?.sumInsured).toBe(rupees(1_000_000));
    expect(inputs.schedule?.provenance).toBe("userEntered");
  });

  it("passes confirmations through", () => {
    const s = reduce(initialState(), { type: "confirmDifferentialBilling", value: false });
    expect(buildInputs(s).confirmations.hospitalFollowsDifferentialBilling).toBe(false);
  });

  it("builds scenarios for both sides", () => {
    const s = reduce(initialState(), { type: "setRate", side: "comparison", ratePerDay: rupees(5_000) });
    expect(scenarioFor(s, "planned")).toEqual({ scenarioId: "planned", label: "Planned room", roomId: ROOM_SINGLE });
    expect(scenarioFor(s, "comparison")).toEqual({
      scenarioId: "comparison",
      label: "Comparison room",
      roomId: ROOM_TWIN,
      roomRatePerDay: rupees(5_000),
    });
  });
});

describe("headlineFor: potential deductions covered by this simulation, never a total", () => {
  it("separates calculated, conditional and unclassified amounts", () => {
    const h = headlineFor(evaluate(demoInputs(), SCENARIO_SINGLE));
    expect(h.calculated).toBe(rupees(15_000));
    expect(h.conditional).toEqual({ low: 0, high: rupees(38_000), basis: expect.any(String) });
    expect(h.unclassified).toBe(rupees(7_500));
    expect(h.unclassifiedCount).toBe(2);
    expect(h.state).toBe("conditional");
    expect(h.summary).toBe("₹15,000 calculated, plus ₹0 to ₹38,000 conditional, plus ₹7,500 not classified");
  });

  it("says plainly when nothing can be determined", () => {
    const h = headlineFor(evaluate({ ...demoInputs(), schedule: null }, SCENARIO_SINGLE));
    expect(h.state).toBe("cannotDetermine");
    expect(h.summary).toMatch(/cannot be determined/i);
  });

  it("gives a single calculated figure once everything is established", () => {
    const h = headlineFor(evaluate({ ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } }, SCENARIO_SINGLE));
    expect(h.state).toBe("calculated");
    expect(h.summary).toBe("₹53,000 calculated, plus ₹7,500 not classified");
  });
});

describe("groupUncertainties: by who can resolve it, plus what is not modelled", () => {
  it("groups the single-private case into user, hospital, insurer and unresolved, and lists unmodelled terms", () => {
    const g = groupUncertainties(evaluate(demoInputs(), SCENARIO_SINGLE));
    expect(g.hospital.map((u) => u.code)).toEqual(["DIFFERENTIAL_BILLING_NOT_ESTABLISHED"]);
    expect(g.insurer.map((u) => u.code)).toEqual(["WORDING_SILENT_ON_ROOM_UNAVAILABILITY"]);
    expect(g.user.map((u) => u.code)).toEqual(["ITEM_NOT_CLASSIFIED"]);
    expect(g.none).toEqual([]);
    expect(g.notModelled.length).toBeGreaterThan(3);
    expect(g.total).toBe(3);
  });
});

describe("stateLabel: the five states have plain words", () => {
  it("labels each state", () => {
    expect(stateLabel("calculated")).toBe("Calculated");
    expect(stateLabel("conditional")).toBe("Conditional");
    expect(stateLabel("unknown")).toBe("Cannot determine");
    expect(stateLabel("excluded")).toBe("Not subject to deduction");
    expect(stateLabel("requiresInsurerConfirmation")).toBe("Requires insurer confirmation");
    expect(stateLabel("reviewRequired")).toBe("Review required");
  });
});

describe("uploads override the demo documents", () => {
  it("replaces the estimate's line items with uploaded CSV items, keeping the demo room options, with upload provenance", () => {
    const s = reduce(initialState(), {
      type: "uploadEstimateItems",
      items: [{ itemId: "line-1", label: "Nursing", category: "nursing", amount: rupees(4_000) }],
      fileName: "bill.csv",
      warnings: ["line 2: something"],
    });
    const inputs = buildInputs(s);
    expect(inputs.estimate.items).toHaveLength(1);
    expect(inputs.estimate.provenance).toBe("upload");
    expect(inputs.estimate.roomOptions).toHaveLength(3);
    expect(s.uploads.estimate?.fileName).toBe("bill.csv");
    expect(s.uploads.estimate?.warnings).toEqual(["line 2: something"]);
  });

  it("replaces the whole estimate from JSON and re-targets both room choices to its options", () => {
    const estimate = {
      ...DEMO_ESTIMATE,
      estimateId: "X",
      roomOptions: [
        { roomId: "r1", label: "R1", ratePerDay: rupees(3_000) },
        { roomId: "r2", label: "R2", ratePerDay: rupees(9_000) },
      ],
    };
    const s = reduce(initialState(), { type: "uploadEstimate", estimate, fileName: "est.json", warnings: [] });
    expect(s.plannedRoom).toEqual({ roomId: "r2" });
    expect(s.comparisonRoom).toEqual({ roomId: "r1" });
    expect(buildInputs(s).estimate.estimateId).toBe("X");
  });

  it("replaces the ruleset and the schedule, and an upload wins over the demo variant", () => {
    let s = reduce(initialState(), { type: "setVariant", variant: "scheduleMissing" });
    s = reduce(s, { type: "uploadSchedule", schedule: { ...DEMO_SCHEDULE, scheduleId: "UP-1", provenance: "upload" }, fileName: "s.json", warnings: [] });
    expect(buildInputs(s).schedule?.scheduleId).toBe("UP-1");
    s = reduce(s, { type: "uploadRuleset", ruleset: { ...DEMO_RULESET, fixtureVersion: "up" }, fileName: "r.json", warnings: [] });
    expect(buildInputs(s).ruleset.fixtureVersion).toBe("up");
  });

  it("records a failed upload as a message and keeps the previous document", () => {
    let s = reduce(initialState(), { type: "uploadFailed", target: "ruleset", fileName: "bad.json", message: "not json" });
    expect(s.uploads.ruleset).toBeUndefined();
    expect(s.uploadErrors.ruleset).toEqual({ fileName: "bad.json", message: "not json" });
    s = reduce(s, { type: "clearUploads" });
    expect(s.uploads).toEqual({});
    expect(s.uploadErrors).toEqual({});
  });

  it("a successful upload clears the error for that document, and reset clears everything", () => {
    let s = reduce(initialState(), { type: "uploadFailed", target: "schedule", fileName: "bad.json", message: "x" });
    s = reduce(s, { type: "uploadSchedule", schedule: DEMO_SCHEDULE, fileName: "ok.json", warnings: [] });
    expect(s.uploadErrors.schedule).toBeUndefined();
    expect(reduce(s, { type: "reset" })).toEqual(initialState());
  });
});

describe("policy switch: the real wording through the same screens", () => {
  it("opens on the synthetic demo policy and can switch to Arogya Sanjeevani and back", () => {
    const s0 = initialState();
    expect(s0.policy).toBe("demo");
    expect(buildInputs(s0).ruleset.metadata.issuer.kind).toBe("synthetic");
    const s1 = reduce(s0, { type: "setPolicy", policy: "arogya" });
    const inputs = buildInputs(s1);
    expect(inputs.ruleset.metadata.issuer.kind).toBe("insurer");
    expect(inputs.schedule?.scheduleId).toBe("DEMO-SCH-AS-0001");
    expect(inputs.estimate.estimateId).toBe("DEMO-EST-0001");
    expect(buildInputs(reduce(s1, { type: "setPolicy", policy: "demo" })).ruleset.metadata.issuer.kind).toBe("synthetic");
  });

  it("switching the policy clears confirmations that belong to the other wording's conditions", () => {
    let s = reduce(initialState(), { type: "confirmDifferentialBilling", value: true });
    s = reduce(s, { type: "setPolicy", policy: "arogya" });
    expect(s.confirmations.hospitalFollowsDifferentialBilling).toBeUndefined();
  });

  it("demo variants apply to the demo policy only; an uploaded ruleset still wins over both", () => {
    let s = reduce(initialState(), { type: "setVariant", variant: "scheduleMissing" });
    s = reduce(s, { type: "setPolicy", policy: "arogya" });
    expect(buildInputs(s).schedule).not.toBeNull();
    s = reduce(s, { type: "uploadRuleset", ruleset: { ...DEMO_RULESET, fixtureVersion: "up" }, fileName: "r.json", warnings: [] });
    expect(buildInputs(s).ruleset.fixtureVersion).toBe("up");
  });

  it("lists the available policies with their labels", () => {
    expect(POLICY_OPTIONS.map((p) => p.id)).toEqual(["demo", "arogya"]);
    expect(POLICY_OPTIONS[1].label).toMatch(/Arogya Sanjeevani/);
  });
});

describe("ruleset builder: proposals are confirmed one by one, then applied as an uploaded ruleset", () => {
  it("records decisions and applies only confirmed, verified proposals", () => {
    let s = reduce(initialState(), { type: "setPolicy", policy: "arogya" });
    s = reduce(s, { type: "decideProposal", proposalId: "p-room-limit", decision: "confirmed" });
    s = reduce(s, { type: "decideProposal", proposalId: "p-copay", decision: "rejected" });
    expect(s.builder.decisions).toEqual({ "p-room-limit": "confirmed", "p-copay": "rejected" });
    s = reduce(s, { type: "applyProposals" });
    expect(s.uploads.ruleset?.fileName).toMatch(/builder/);
    const inputs = buildInputs(s);
    expect(inputs.ruleset.rules.roomLimit).toBeDefined();
    expect(inputs.ruleset.rules.copay).toBeUndefined();
    expect(inputs.ruleset.rules.proportionateDeduction).toBeUndefined();
  });

  it("does nothing when nothing is confirmed, and reset clears the decisions", () => {
    let s = reduce(initialState(), { type: "setPolicy", policy: "arogya" });
    s = reduce(s, { type: "applyProposals" });
    expect(s.uploads.ruleset).toBeUndefined();
    s = reduce(s, { type: "decideProposal", proposalId: "p-copay", decision: "confirmed" });
    expect(reduce(s, { type: "reset" }).builder.decisions).toEqual({});
  });

  it("exposes the cached proposals for the real wording and none for the synthetic one", () => {
    expect(proposalsFor("arogya").length).toBeGreaterThan(4);
    expect(proposalsFor("demo")).toEqual([]);
  });
});
