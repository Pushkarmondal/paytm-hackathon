/**
 * Prints the real-wording figures that appear on the pitch deck, straight from the engine,
 * so they can be checked against docs/deck/CALCULATION-AUDIT.md by hand.
 *
 *   npx tsx scripts/deck-figures.ts
 */
import { evaluate } from "../src/engine/evaluate";
import { arogyaInputs } from "../src/fixtures/arogya-sanjeevani-nia";
import type { Money } from "../src/engine/money";
import type { Range } from "../src/engine/types";

const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: Money | Range | null | undefined) =>
  v == null ? "—" : typeof v === "number" ? inr(v) : `${inr(v.low)} to ${inr(v.high)}`;

const inputs = arogyaInputs();
console.log(`${inputs.ruleset.metadata.name} · sum insured ${money(inputs.schedule!.sumInsured)} · ${inputs.estimate.roomDays} room days`);

for (const room of inputs.estimate.roomOptions) {
  const r = evaluate(inputs, { scenarioId: room.roomId, label: room.label, roomId: room.roomId });
  console.log(`\n## ${room.label} at ${money(room.ratePerDay)} per day · overall ${r.overallState}`);
  console.log(`room limit ${money(r.roomLimit.eligiblePerDay)} · room excess ${money(r.roomExcess.value)} · ICU limit ${money(r.icuLimit.eligiblePerDay)} · ICU excess ${money(r.icuExcess.value)}`);
  const d = r.deductionRule;
  console.log(`proportion: ${d.applicability}, ratio ${d.ratio ? `${d.ratio.num}/${d.ratio.den}` : "none (bounds)"}, trigger ${d.trigger ?? "none"}`);
  for (const it of r.items) {
    const out = it.deduction;
    const v = out.state === "unknown" ? "—" : money((out as { value?: Money | null; range?: Range }).range ?? (out as { value?: Money | null }).value ?? null);
    console.log(`  ${it.label.padEnd(28)} ${money(it.amount).padStart(14)}  ${it.classification.padEnd(22)} ${v.padStart(28)}  ${out.state}`);
  }
  console.log(`co-payment ${money(r.copay.range ?? r.copay.value)} (${r.copay.state})`);
  const t = r.totals;
  console.log(`scenario total ${money(t.scenarioTotal)} · calculated ${money(t.calculatedDeductions)} · conditional ${money(t.conditionalDeductions)} · not classified ${money(t.unclassifiedAmount)} (${t.unclassifiedCount} items)`);
}
