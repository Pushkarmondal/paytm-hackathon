"use client";

import { useMemo, useState } from "react";
import { KIND_LABEL, verifyProposals } from "@/ai";
import { proposalFieldChecks } from "@/ai/compare";
import type { CaseInputs } from "@/engine/types";
import { NIA_RULESET } from "@/fixtures/arogya-sanjeevani-nia";
import { type Action, type AppState, proposalsFor } from "@/model";
import { retrieveClauses } from "@/retrieval";
import { ProvenanceBadge } from "../badges";
import { money } from "../format";

interface Props {
  state: AppState;
  inputs: CaseInputs;
  dispatch: (action: Action) => void;
}

function proposedText(p: ReturnType<typeof proposalsFor>[number]): string[] {
  const f = p.proposed;
  const out: string[] = [];
  if (f.basis) {
    if (f.basis.kind === "percentOfSumInsuredPerDay") out.push(`${f.basis.percent}% of the sum insured per day${f.basis.capPerDay !== undefined ? `, capped at ${money(f.basis.capPerDay)} per day` : ""}`);
    else if (f.basis.kind === "fixedPerDay") out.push(`${money(f.basis.amount)} per day`);
    else out.push("as stated on the schedule");
  }
  if (f.triggers) out.push(`triggered by: ${f.triggers.join(" or ")} rate above its limit`);
  if (f.conditions) out.push(f.conditions.length ? `conditions: ${f.conditions.join(", ")}` : "no conditions");
  if (f.included) out.push(`touches: ${f.included.join(", ")}`);
  if (f.excluded) out.push(`does not touch: ${f.excluded.length ? f.excluded.join(", ") : "nothing named"}`);
  if (f.percent !== undefined) out.push(`${f.percent}% of the admissible amount`);
  return out;
}

export function BuilderScreen({ state, inputs, dispatch }: Props) {
  const clauses = inputs.ruleset.clauses;
  const proposals = useMemo(() => proposalsFor(state.policy), [state.policy]);
  const verified = useMemo(() => verifyProposals(proposals, clauses), [proposals, clauses]);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => (query.trim() ? retrieveClauses(query, clauses, 3) : []), [query, clauses]);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const confirmedCount = verified.filter((v) => state.builder.decisions[v.proposal.id] === "confirmed" && v.verification.quoteFound).length;
  const applied = state.uploads.ruleset?.fileName.startsWith("builder");
  const reviewed = state.policy === "arogya" ? NIA_RULESET : null;

  const proposeLive = async () => {
    setLiveBusy(true);
    setLiveMessage(null);
    try {
      const res = await fetch("/api/propose-rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clauses }) });
      const data = (await res.json()) as { error?: string; proposals?: unknown[] };
      setLiveMessage(res.ok ? `The live adapter returned ${data.proposals?.length ?? 0} proposals. Live proposals are not wired into this screen in this build; the cached set below is what the demo uses.` : (data.error ?? `The live adapter answered ${res.status}.`));
    } catch {
      setLiveMessage("The live adapter could not be reached.");
    } finally {
      setLiveBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-stone-500">Ruleset builder</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">A model proposes. The engine checks the quote. You confirm.</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
          Candidate rules for a public policy wording. Each proposal cites a clause and quotes it; the quote is checked verbatim before you can confirm. Confirmed proposals become the active ruleset, with the full clause as evidence. The model never calculates and never sees a schedule, a bill or a name.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">Find the clause</h2>
        <p className="mt-0.5 text-sm text-stone-600">Keyword retrieval over the wording, no model. Points you at where to read.</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. what happens if the room rate exceeds the limit"
          aria-label="Find the clause"
          className="mt-3 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
        {query.trim() ? (
          <ol className="mt-3 flex flex-col gap-2">
            {hits.length === 0 ? <li className="text-sm text-stone-500">No clause shares a term with that question.</li> : null}
            {hits.map((h) => {
              const c = clauses.find((x) => x.id === h.clauseId)!;
              return (
                <li key={h.clauseId} className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-stone-500">{c.id} · p.{c.page} · score {h.score.toFixed(2)}</span>
                  <span className="ml-2 font-medium text-stone-900">{c.title}</span>
                  <p className="mt-1 leading-6 text-stone-700">{c.text}</p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Proposals for {inputs.ruleset.metadata.name}</h2>
            <p className="mt-0.5 text-sm text-stone-600">
              {proposals.length > 0 ? proposals[0].provenance?.note ?? "Cached proposals." : "No cached proposals exist for this wording."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={proposeLive} disabled={liveBusy} className="inline-flex h-9 items-center rounded-lg border border-stone-300 px-3 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">
              {liveBusy ? "Asking…" : "Try the live adapter"}
            </button>
            <button type="button" onClick={() => dispatch({ type: "clearDecisions" })} className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">
              Clear decisions
            </button>
          </div>
        </div>
        {liveMessage ? <p role="status" className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">{liveMessage}</p> : null}

        {proposals.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-600">
            Switch to the Arogya Sanjeevani wording on Input review to see its cached proposals, or enable the live adapter for any public wording.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {verified.map(({ proposal: p, verification }) => {
              const decision = state.builder.decisions[p.id];
              const clause = clauses.find((c) => c.id === p.clauseId);
              const checks = reviewed ? proposalFieldChecks(p, reviewed) : [];
              const differs = checks.filter((c) => !c.same);
              return (
                <li key={p.id} className={`rounded-lg border p-4 ${decision === "confirmed" ? "border-emerald-300 bg-emerald-50/40" : decision === "rejected" ? "border-stone-200 bg-stone-50 opacity-70" : "border-stone-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{KIND_LABEL[p.kind]}</p>
                      <p className="text-xs text-stone-500">Clause {p.clauseId}{clause ? `, page ${clause.page}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {verification.quoteFound ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">Quote verified verbatim</span>
                      ) : (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-900 ring-1 ring-rose-200">Quote not found: cannot be confirmed</span>
                      )}
                      {reviewed ? (
                        differs.length === 0 ? (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-300">Agrees with the reviewed ruleset</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">Differs from the reviewed ruleset: {differs.map((d) => d.field.split(".")[1]).join(", ")}</span>
                        )
                      ) : null}
                      {p.provenance ? <ProvenanceBadge provenance="upload" /> : null}
                    </div>
                  </div>
                  <blockquote className="mt-3 rounded-lg border-l-4 border-stone-900 bg-stone-50 px-4 py-2 text-sm leading-6 text-stone-800">“{p.quotedText}”</blockquote>
                  <ul className="mt-3 flex flex-col gap-0.5 text-sm text-stone-800">
                    {proposedText(p).map((t) => (
                      <li key={t}>• {t}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-stone-600">{p.rationale}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!verification.quoteFound}
                      onClick={() => dispatch({ type: "decideProposal", proposalId: p.id, decision: "confirmed" })}
                      className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-40 ${decision === "confirmed" ? "bg-emerald-700 text-white" : "border border-stone-300 text-stone-800 hover:bg-stone-50"}`}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "decideProposal", proposalId: p.id, decision: "rejected" })}
                      className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${decision === "rejected" ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-800 hover:bg-stone-50"}`}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {proposals.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
            <button
              type="button"
              disabled={confirmedCount === 0}
              onClick={() => dispatch({ type: "applyProposals" })}
              className="inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            >
              Apply {confirmedCount} confirmed proposal{confirmedCount === 1 ? "" : "s"} as the ruleset
            </button>
            {applied ? <span className="text-sm text-emerald-800">Applied. Every screen now uses the ruleset you confirmed ({state.uploads.ruleset?.fileName}). Clear uploads on Input review to go back.</span> : <span className="text-sm text-stone-500">Unconfirmed proposals are left out; the engine runs on what you confirmed.</span>}
          </div>
        ) : null}
      </section>
    </div>
  );
}
