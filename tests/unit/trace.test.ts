import { describe, expect, it } from "vitest";
import { evaluate } from "@/engine/evaluate";
import { collectTraces, validateTrace } from "@/engine/trace";
import {
  DEMO_RULESET,
  DEMO_SCHEDULE_CONTRADICTORY,
  SCENARIO_DELUXE,
  SCENARIO_SINGLE,
  SCENARIO_TWIN,
  demoInputs,
} from "@/fixtures/demo-policy";

describe("every displayed calculated result has a valid trace", () => {
  const cases = [
    evaluate(demoInputs(), SCENARIO_TWIN),
    evaluate(demoInputs(), SCENARIO_SINGLE),
    evaluate({ ...demoInputs(), confirmations: { hospitalFollowsDifferentialBilling: true } }, SCENARIO_DELUXE),
    evaluate({ ...demoInputs(), schedule: null }, SCENARIO_SINGLE),
    evaluate({ ...demoInputs(), schedule: DEMO_SCHEDULE_CONTRADICTORY }, SCENARIO_SINGLE),
  ];

  it("attaches a trace to every calculated, conditional or excluded amount", () => {
    for (const r of cases) {
      for (const item of r.items) {
        if (["calculated", "conditional", "excluded"].includes(item.deduction.state)) {
          expect(item.trace, `${r.scenario.scenarioId}/${item.itemId}`).not.toBeNull();
        } else {
          expect(item.trace, `${r.scenario.scenarioId}/${item.itemId}`).toBeNull();
        }
      }
      for (const block of [r.roomLimit, r.icuLimit, r.roomExcess, r.icuExcess]) {
        if (block.state === "calculated") expect(block.trace).not.toBeNull();
        else expect(block.trace).toBeNull();
      }
    }
  });

  it("validates each trace against the wording's clauses", () => {
    const schedules = [DEMO_SCHEDULE_CONTRADICTORY];
    for (const r of cases) {
      for (const trace of collectTraces(r)) {
        const problems = validateTrace(trace, DEMO_RULESET.clauses, schedules);
        expect(problems, `${r.scenario.scenarioId}/${trace.ruleId}: ${problems.join("; ")}`).toEqual([]);
      }
    }
  });

  it("rejects a trace whose quoted text is not in the source document", () => {
    const [trace] = collectTraces(evaluate(demoInputs(), SCENARIO_SINGLE));
    const tampered = { ...trace, source: { ...trace.source, quotedText: "words the policy never says" } };
    expect(validateTrace(tampered, DEMO_RULESET.clauses, [])).not.toEqual([]);
  });

  it("rejects a calculated output without a value, and a conditional output without a range", () => {
    const [trace] = collectTraces(evaluate(demoInputs(), SCENARIO_SINGLE));
    expect(validateTrace({ ...trace, output: { state: "calculated", value: null } }, DEMO_RULESET.clauses, [])).not.toEqual([]);
    expect(validateTrace({ ...trace, output: { state: "conditional", value: null } }, DEMO_RULESET.clauses, [])).not.toEqual([]);
  });

  it("rejects a trace with no inputs or an empty formula", () => {
    const [trace] = collectTraces(evaluate(demoInputs(), SCENARIO_SINGLE));
    expect(validateTrace({ ...trace, inputs: [] }, DEMO_RULESET.clauses, [])).not.toEqual([]);
    expect(validateTrace({ ...trace, formula: "" }, DEMO_RULESET.clauses, [])).not.toEqual([]);
  });
});
