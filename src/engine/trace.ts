import type { Clause, PolicySchedule, SimulationResult, Trace } from "./types";

/** Every trace a result carries, in display order. */
export function collectTraces(result: SimulationResult): Trace[] {
  const traces: Trace[] = [];
  for (const block of [result.roomLimit, result.icuLimit, result.roomExcess, result.icuExcess]) {
    if (block.trace) traces.push(block.trace);
  }
  if (result.deductionRule.trace) traces.push(result.deductionRule.trace);
  for (const item of result.items) {
    if (item.trace) traces.push(item.trace);
  }
  return traces;
}

/**
 * Checks that a trace is complete and that its quoted text really appears in
 * the source documents. Returns the list of problems; an empty list is valid.
 */
export function validateTrace(trace: Trace, clauses: readonly Clause[], schedules: readonly PolicySchedule[] = []): string[] {
  const problems: string[] = [];
  if (!trace.ruleId) problems.push("ruleId is empty");
  if (!trace.ruleName) problems.push("ruleName is empty");
  if (trace.inputs.length === 0) problems.push("no inputs");
  if (!trace.formula) problems.push("formula is empty");
  if (!trace.operation) problems.push("operation is empty");

  const s = trace.source;
  if (!s.documentId || !s.documentTitle || !s.clauseId || !s.quotedText) {
    problems.push("source is incomplete");
  }
  if (!Number.isInteger(s.page) || s.page < 0) problems.push("source page is not a non-negative integer");

  const clause = clauses.find((c) => c.id === s.clauseId);
  const inClause = clause !== undefined && clause.text === s.quotedText && clause.page === s.page;
  const inSchedule = schedules.some((sch) =>
    [sch.roomLimitPerDay?.source, sch.icuLimitPerDay?.source].some(
      (src) => src && src.documentId === s.documentId && src.quotedText === s.quotedText,
    ),
  );
  if (!inClause && !inSchedule) {
    problems.push(`quoted text for ${s.clauseId} is not in the source documents`);
  }

  const o = trace.output;
  switch (o.state) {
    case "calculated":
      if (o.value === null) problems.push("calculated output has no value");
      if (o.range) problems.push("calculated output must not carry a range");
      break;
    case "conditional":
      if (!o.range) problems.push("conditional output has no range");
      else if (o.range.low > o.range.high) problems.push("conditional range is inverted");
      if (o.value !== null) problems.push("conditional output must not carry a single value");
      if (trace.assumptions.length === 0) problems.push("conditional output lists no assumption");
      break;
    case "excluded":
      if (o.value !== 0) problems.push("excluded output must be zero");
      break;
    default:
      problems.push(`a trace must not exist for state ${o.state}`);
  }
  return problems;
}
