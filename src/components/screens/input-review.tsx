"use client";

import { useId } from "react";
import { rupees } from "@/engine/money";
import type { CaseInputs, Provenance, SimulationResult, UserClassification } from "@/engine/types";
import { type Action, type AppState, DEMO_VARIANTS, POLICY_OPTIONS } from "@/model";
import { Amount } from "../amounts";
import { IssuerBadge, ProvenanceBadge, StateBadge } from "../badges";
import { issuerLabel, money } from "../format";
import { UploadSection } from "../upload-section";

interface Props {
  state: AppState;
  inputs: CaseInputs;
  result: SimulationResult;
  dispatch: (action: Action) => void;
}

function Section({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {blurb ? <p className="mt-0.5 text-sm text-stone-600">{blurb}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-stone-100 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-sm text-stone-600">{label}</span>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-stone-900">{children}</div>
    </div>
  );
}

const CLASS_OPTIONS: { value: "" | UserClassification; label: string }[] = [
  { value: "", label: "Leave unclassified" },
  { value: "includedInDeduction", label: "Count as an Associated Medical Expense" },
  { value: "excludedFromDeduction", label: "Treat as not subject to the deduction" },
];

export function InputReviewScreen({ state, inputs, result, dispatch }: Props) {
  const siId = useId();
  const daysId = useId();
  const { ruleset, schedule, estimate } = inputs;
  const confirmed = state.confirmations.hospitalFollowsDifferentialBilling;
  // Hospital, procedure, room days and room options come from the demo unless a full estimate was uploaded.
  const estimateMetaProvenance: Provenance = state.uploads.estimate?.kind === "full" ? "upload" : "fixture";
  const dbValue = confirmed === undefined ? "" : confirmed ? "yes" : "no";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-stone-500">Input review</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Every value the engine uses, and where it came from</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
          Correct a value or confirm a fact here and every trace updates its provenance. Nothing you enter leaves this browser.
        </p>
      </div>

      <Section title="Policy wording in use" blurb="Two wordings ship in the box: the synthetic demo policy, and a real IRDAI-hosted wording encoded partially and quoted verbatim.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {POLICY_OPTIONS.map((p) => {
            const active = p.id === state.policy;
            return (
              <label key={p.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${active ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:bg-stone-50"}`}>
                <input type="radio" name="policy" value={p.id} checked={active} onChange={() => dispatch({ type: "setPolicy", policy: p.id })} className="mt-1 accent-stone-900" />
                <span>
                  <span className="block text-sm font-medium text-stone-900">{p.label}</span>
                  <span className="block text-xs leading-5 text-stone-600">{p.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {ruleset.metadata.verification ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-950">
            <p className="font-medium">Verification record</p>
            <p>
              Fetched {ruleset.metadata.verification.fetchedOn} from{" "}
              <a href={ruleset.metadata.verification.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">irdai.gov.in</a>, {ruleset.metadata.verification.pages} pages. SHA-256 <span className="font-mono">{ruleset.metadata.verification.sha256.slice(0, 16)}…</span>. {ruleset.metadata.verification.extractedWith}.
            </p>
            <p>Encoded clauses: {ruleset.metadata.verification.encodedClauses.join(", ")}. {ruleset.metadata.verification.note}</p>
          </div>
        ) : null}
      </Section>

      {state.policy === "demo" ? (
      <Section title="Demo case" blurb="Switch the seeded documents to see how the engine refuses to overstate when something is missing or contradictory.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_VARIANTS.map((v) => {
            const active = v.id === state.variant;
            return (
              <label key={v.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${active ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:bg-stone-50"}`}>
                <input type="radio" name="variant" value={v.id} checked={active} onChange={() => dispatch({ type: "setVariant", variant: v.id })} className="mt-1 accent-stone-900" />
                <span>
                  <span className="block text-sm font-medium text-stone-900">{v.label}</span>
                  <span className="block text-xs leading-5 text-stone-600">{v.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Section>
      ) : null}

      <UploadSection uploads={state.uploads} errors={state.uploadErrors} dispatch={dispatch} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Policy wording">
          <Field label="Policy">{ruleset.metadata.name}</Field>
          <Field label="Issuer">
            <span className="text-right text-xs text-stone-600">{issuerLabel(ruleset.metadata.issuer)}</span>
            <IssuerBadge issuer={ruleset.metadata.issuer} />
          </Field>
          <Field label="Wording version">{ruleset.metadata.wordingVersion}</Field>
          <Field label="Rules encoded">
            <span className="text-right text-xs text-stone-600">
              {[ruleset.rules.roomLimit && "room limit", ruleset.rules.icuLimit && "ICU limit", ruleset.rules.proportionateDeduction && "proportionate deduction", ruleset.rules.itemClasses && "item classes", ruleset.rules.copay && "co-payment", ruleset.rules.sumInsuredCap && "sum insured cap"].filter(Boolean).join(", ")}
            </span>
          </Field>
          <details className="mt-3 rounded-lg border border-stone-200 bg-stone-50">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-stone-800">Read the full wording ({ruleset.clauses.length} clauses)</summary>
            <ol className="flex flex-col gap-3 px-4 pb-4 pt-1">
              {ruleset.clauses.map((c) => (
                <li key={c.id} className="text-sm leading-6 text-stone-800">
                  <span className="font-mono text-xs text-stone-500">{c.id} · p.{c.page}</span> <span className="font-medium">{c.title}.</span> {c.text}
                </li>
              ))}
            </ol>
          </details>
        </Section>

        <Section title="Policy schedule">
          {schedule ? (
            <>
              <Field label="Schedule">
                {schedule.scheduleId} <ProvenanceBadge provenance={schedule.provenance} />
              </Field>
              <Field label="Insured">{schedule.insuredLabel}</Field>
              <Field label="Policy period">
                {schedule.policyPeriod.from} to {schedule.policyPeriod.to}
              </Field>
              <Field label="Sum insured">
                <label htmlFor={siId} className="sr-only">Sum insured in rupees</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-stone-500">₹</span>
                  <input
                    id={siId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100000}
                    value={schedule.sumInsured / 100}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 0) dispatch({ type: "setSumInsured", sumInsured: rupees(n) });
                    }}
                    className="h-9 w-40 rounded-lg border border-stone-300 bg-white pl-6 pr-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
                <ProvenanceBadge provenance={schedule.provenance} />
              </Field>
              <Field label="Room limit printed on the schedule">
                {schedule.roomLimitPerDay ? (
                  <span className="text-right text-xs text-stone-700">“{schedule.roomLimitPerDay.source.quotedText}”</span>
                ) : (
                  <span className="text-stone-500">Not printed</span>
                )}
              </Field>
              <Field label="ICU limit printed on the schedule">
                {schedule.icuLimitPerDay ? <span className="text-right text-xs text-stone-700">“{schedule.icuLimitPerDay.source.quotedText}”</span> : <span className="text-stone-500">Not printed</span>}
              </Field>
              <Field label="Room limit the engine applies">
                {result.roomLimit.eligiblePerDay !== null ? `${money(result.roomLimit.eligiblePerDay)} per day` : <StateBadge state={result.roomLimit.state} />}
              </Field>
            </>
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
              No policy schedule is loaded. The wording refers to the schedule for the Sum Insured, so no room or ICU limit can be determined and no deduction is calculated. Switch the demo case above to restore it.
            </div>
          )}
        </Section>
      </div>

      <Section title="Hospital estimate" blurb="Line items as supplied. Room rent is derived from the room you pick, so it is not a line here.">
        <Field label="Hospital">
          {estimate.hospitalLabel} <ProvenanceBadge provenance={estimateMetaProvenance} />
        </Field>
        <Field label="Procedure">{estimate.procedureLabel}</Field>
        <Field label="Room days">
          <label htmlFor={daysId} className="sr-only">Room days</label>
          <input
            id={daysId}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={estimate.roomDays}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 60) dispatch({ type: "setRoomDays", days: n });
            }}
            className="h-9 w-24 rounded-lg border border-stone-300 bg-white px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
          <ProvenanceBadge provenance={state.edits.roomDays !== undefined ? "userEntered" : estimateMetaProvenance} />
        </Field>
        <Field label="Hospital follows differential billing by room category">
          <span className="text-xs text-stone-500">
            Estimate says: {estimate.differentialBilling === "notStated" ? "not stated" : estimate.differentialBilling}
          </span>
          <select
            aria-label="Hospital follows differential billing by room category"
            value={dbValue}
            onChange={(e) => dispatch({ type: "confirmDifferentialBilling", value: e.target.value === "" ? null : e.target.value === "yes" })}
            className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          >
            <option value="">Not confirmed</option>
            <option value="yes">Yes, confirmed by me</option>
            <option value="no">No, confirmed by me</option>
          </select>
          {confirmed !== undefined ? <ProvenanceBadge provenance="userConfirmed" /> : null}
        </Field>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
              <th scope="col" className="py-2 text-left font-medium">Item</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
              <th scope="col" className="py-2 text-left font-medium pl-4">Classification</th>
              <th scope="col" className="py-2 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => {
              const override = state.confirmations.itemClassifications?.[item.itemId] ?? "";
              const unknownByPolicy = item.classificationSource === null && item.classification !== "roomRent";
              return (
                <tr key={item.itemId} className="border-t border-stone-100 align-top">
                  <th scope="row" className="py-2.5 text-left font-normal text-stone-900">
                    {item.label}
                    <span className="block font-mono text-[11px] text-stone-400">{item.category}</span>
                  </th>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">
                    <Amount paise={item.amount} />
                  </td>
                  <td className="py-2.5 pl-4">
                    {unknownByPolicy ? (
                      <select
                        aria-label={`Classification of ${item.label}`}
                        value={override}
                        onChange={(e) => dispatch({ type: "classifyItem", itemId: item.itemId, classification: e.target.value === "" ? null : (e.target.value as UserClassification) })}
                        className="h-9 w-full max-w-xs rounded-lg border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                      >
                        {CLASS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-stone-800">
                        {item.classification === "includedInDeduction" ? "Associated Medical Expense" : item.classification === "icu" ? "ICU charges" : "Not subject to the deduction"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {item.classificationSource ? (
                      <span className="text-xs text-stone-600">Clause {item.classificationSource.clauseId}</span>
                    ) : item.classificationProvenance === "userConfirmed" ? (
                      <ProvenanceBadge provenance="userConfirmed" />
                    ) : (
                      <span className="text-xs text-stone-500">Wording silent</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
