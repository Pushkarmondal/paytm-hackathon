import { collectTraces } from "@/engine/trace";
import type { CaseInputs, SimulationResult, Trace } from "@/engine/types";
import { formatInr } from "@/lib/format-inr";
import { headlineFor, stateLabel } from "./index";
import { DISCLAIMER_TEXT } from "./questions";

function money(paise: number): string {
  return formatInr(paise, { paise: paise % 100 !== 0 });
}

function value(v: Trace["inputs"][number]["value"]): string {
  switch (v.kind) {
    case "money":
      return money(v.paise);
    case "days":
      return `${v.days} days`;
    case "ratio":
      return `${v.ratio.num}/${v.ratio.den}`;
    case "percent":
      return `${v.percent}%`;
    case "text":
      return v.text;
    case "boolean":
      return v.value ? "yes" : "no";
  }
}

function outputText(t: Trace): string {
  if (t.output.range) return `${money(t.output.range.low)} to ${money(t.output.range.high)} (${stateLabel(t.output.state)})`;
  if (t.output.value === null) return stateLabel(t.output.state);
  return `${money(t.output.value)} (${stateLabel(t.output.state)})`;
}

/** The whole result as a Markdown document: policy, scenario, items, every trace, uncertainties, disclaimer. */
export function evidencePackMarkdown(result: SimulationResult, inputs: CaseInputs): string {
  const { ruleset, schedule } = inputs;
  const head = headlineFor(result);
  const issuer = ruleset.metadata.issuer;
  const lines: string[] = [
    "# Claim Sach evidence pack",
    "",
    `Engine ${result.engineVersion}, fixture ${result.fixtureVersion}.`,
    "",
    "## Policy",
    "",
    `- ${ruleset.metadata.name}, wording ${ruleset.metadata.wordingVersion}`,
    issuer.kind === "synthetic" ? `- ${issuer.label}` : `- Issued by ${issuer.name}${issuer.uin ? `, UIN ${issuer.uin}` : ""}; real wording, partially encoded`,
  ];
  if (ruleset.metadata.verification) {
    const v = ruleset.metadata.verification;
    lines.push(`- Verification: fetched ${v.fetchedOn} from ${v.url}; ${v.pages} pages; SHA-256 ${v.sha256}; ${v.extractedWith}. Encoded clauses: ${v.encodedClauses.join(", ")}. ${v.note}`);
  }
  lines.push(schedule ? `- Schedule ${schedule.scheduleId}: sum insured ${money(schedule.sumInsured)}, insured ${schedule.insuredLabel}` : "- Schedule: missing");
  lines.push(
    "",
    "## Scenario",
    "",
    `- Room: ${result.scenario.roomLabel}, ${money(result.scenario.ratePerDay)} per day, ${result.scenario.roomDays} days (room rent ${money(result.totals.roomRent)})`,
    `- Estimate: ${inputs.estimate.procedureLabel}, ${inputs.estimate.hospitalLabel}; non-room items ${money(result.totals.nonRoomItems)}; scenario total ${money(result.totals.scenarioTotal)}`,
    `- Differential billing: ${inputs.confirmations.hospitalFollowsDifferentialBilling === undefined ? inputs.estimate.differentialBilling : inputs.confirmations.hospitalFollowsDifferentialBilling ? "yes (confirmed by the user)" : "no (confirmed by the user)"}`,
    "",
    "## Potential deductions covered by this simulation",
    "",
    `**${head.summary}** (overall state: ${result.overallState}). Not the total out-of-pocket cost.`,
    "",
    "## Items",
    "",
    "| Item | Amount | Classification | Deduction | State |",
    "|---|---|---|---|---|",
    ...result.items.map((i) => `| ${i.label} | ${money(i.amount)} | ${i.classification} | ${i.deduction.range ? `${money(i.deduction.range.low)} to ${money(i.deduction.range.high)}` : i.deduction.value === null ? "—" : money(i.deduction.value)} | ${stateLabel(i.deduction.state)} |`),
    "",
    "## Traces",
    "",
  );
  for (const t of collectTraces(result)) {
    lines.push(`### ${t.ruleName} (${t.ruleId})`, "", `Clause ${t.source.clauseId}, page ${t.source.page}. ${t.source.documentTitle}, version ${t.source.version}.`, "", `> ${t.source.quotedText}`, "", "Inputs:", "");
    for (const i of t.inputs) lines.push(`- ${i.name}: ${value(i.value)} (${i.provenance})`);
    lines.push("", `Formula: \`${t.formula}\``, "", `Result: ${outputText(t)}`, "");
    if (t.assumptions.length) {
      lines.push("Open assumptions:", "");
      for (const a of t.assumptions) lines.push(`- ${a.code}: ${a.text}`);
      lines.push("");
    }
  }
  lines.push("## What remains uncertain", "");
  if (result.uncertainties.length === 0) lines.push("Nothing open.", "");
  for (const u of result.uncertainties) {
    lines.push(`- **${u.code}** (resolvable by: ${u.resolvableBy}): ${u.text}${u.amountAtStake ? ` At stake: ${money(u.amountAtStake.low)} to ${money(u.amountAtStake.high)}.` : ""} ${u.whatWouldResolveIt}`);
  }
  lines.push("", "## Not modelled by this version", "", ...result.notModelled.map((n) => `- ${n}`), "", "## Disclaimer", "", DISCLAIMER_TEXT, "");
  return lines.join("\n");
}

/** The same content as data. */
export function evidencePackJson(result: SimulationResult, inputs: CaseInputs): string {
  return JSON.stringify({ generatedBy: "Claim Sach", engineVersion: result.engineVersion, fixtureVersion: result.fixtureVersion, disclaimer: DISCLAIMER_TEXT, inputs, result }, null, 2);
}
