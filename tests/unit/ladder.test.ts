import { describe, expect, it } from "vitest";
import { rupees } from "@/engine/money";
import { buildLadder } from "@/model/ladder";
import { arogyaInputs } from "@/fixtures/arogya-sanjeevani-nia";
import { demoInputs } from "@/fixtures/demo-policy";

describe("room ladder: every room option on one view", () => {
  const ladder = buildLadder(demoInputs());

  it("lists the rooms in ascending rate with their deductions", () => {
    expect(ladder.rows.map((r) => r.roomId)).toEqual(["twin-sharing", "single-private", "deluxe"]);
    expect(ladder.rows.map((r) => r.ratePerDay)).toEqual([rupees(4_500), rupees(7_500), rupees(12_000)]);
    expect(ladder.rows.map((r) => r.calculated)).toEqual([rupees(5_000), rupees(15_000), rupees(33_000)]);
    expect(ladder.rows[0].conditional).toBeNull();
    expect(ladder.rows[1].conditional?.high).toBe(rupees(38_000));
    expect(ladder.rows[2].conditional?.high).toBe(rupees(66_500));
    expect(ladder.rows.map((r) => r.scenarioTotal)).toEqual([rupees(311_500), rupees(323_500), rupees(341_500)]);
  });

  it("marks the highest room whose rate is within the room-rent limit", () => {
    expect(ladder.rows.map((r) => r.withinRoomLimit)).toEqual([true, false, false]);
    expect(ladder.bestWithinLimitRoomId).toBe("twin-sharing");
  });

  it("says when no room is within the limit, instead of picking one", () => {
    const inputs = demoInputs();
    const expensive = { ...inputs, estimate: { ...inputs.estimate, roomOptions: inputs.estimate.roomOptions.map((o) => ({ ...o, ratePerDay: rupees(9_000) })) } };
    expect(buildLadder(expensive).bestWithinLimitRoomId).toBeNull();
  });

  it("carries the room-limit state when the limit cannot be determined", () => {
    const l = buildLadder({ ...demoInputs(), schedule: null });
    expect(l.rows.every((r) => r.withinRoomLimit === null)).toBe(true);
    expect(l.bestWithinLimitRoomId).toBeNull();
  });

  it("works on the real wording, where the ICU day already triggers the proportion in every room", () => {
    const l = buildLadder(arogyaInputs());
    expect(l.rows.map((r) => r.calculated)).toEqual([rupees(45_000), rupees(55_000), rupees(33_000)]);
    expect(l.bestWithinLimitRoomId).toBe("twin-sharing");
  });
});
