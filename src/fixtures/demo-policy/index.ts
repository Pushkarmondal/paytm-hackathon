import type { CaseInputs } from "@/engine/types";
import { DEMO_ESTIMATE } from "./estimate";
import { DEMO_RULESET } from "./ruleset";
import { DEMO_SCHEDULE } from "./schedule";

export * from "./estimate";
export * from "./ruleset";
export * from "./schedule";
export * from "./wording";

/** The case the app opens with. Deterministic; nothing confirmed yet. */
export function demoInputs(): CaseInputs {
  return {
    ruleset: DEMO_RULESET,
    schedule: DEMO_SCHEDULE,
    estimate: DEMO_ESTIMATE,
    confirmations: {},
  };
}
