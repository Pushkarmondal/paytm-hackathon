import type { CaseInputs } from "@/engine/types";
import { DEMO_ESTIMATE } from "@/fixtures/demo-policy/estimate";
import { NIA_DEMO_SCHEDULE, NIA_RULESET } from "./ruleset";

export * from "./ruleset";
export * from "./wording";

/** The real wording with the synthetic demo schedule and estimate. */
export function arogyaInputs(): CaseInputs {
  return { ruleset: NIA_RULESET, schedule: NIA_DEMO_SCHEDULE, estimate: DEMO_ESTIMATE, confirmations: {} };
}
