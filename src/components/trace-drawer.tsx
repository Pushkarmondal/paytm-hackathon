"use client";

import { useEffect, useRef } from "react";
import type { Trace } from "@/engine/types";
import { explainTrace } from "@/explain";
import { ProvenanceBadge, StateBadge } from "./badges";
import { OutputAmount } from "./amounts";
import { inputLabel, traceValue } from "./format";

interface Props {
  title: string;
  trace: Trace;
  onClose: () => void;
}

export function TraceDrawer({ title, trace, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button aria-label="Close the calculation details" className="absolute inset-0 bg-stone-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="trace-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">How this was calculated</p>
            <h2 id="trace-title" className="mt-1 text-lg font-semibold text-stone-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {trace.ruleName} <span className="font-mono text-xs text-stone-400">{trace.ruleId}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            Close
          </button>
        </header>

        <div className="flex flex-col gap-6 px-6 py-5">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Result</h3>
              <StateBadge state={trace.output.state} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-stone-900">
              <OutputAmount output={trace.output} precise />
            </p>
            {trace.output.range ? <p className="mt-1 text-sm text-stone-600">{trace.output.range.basis}</p> : null}
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">In plain words</h3>
            <p className="mt-2 text-sm leading-6 text-stone-800">{explainTrace(trace)}</p>
            <p className="mt-1 text-xs text-stone-400">Generated from the trace by the deterministic explainer, not by a language model.</p>
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Source clause</h3>
            <blockquote className="mt-2 rounded-lg border-l-4 border-stone-900 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800">
              “{trace.source.quotedText}”
            </blockquote>
            <p className="mt-2 text-xs text-stone-500">
              Clause {trace.source.clauseId}, page {trace.source.page}. {trace.source.documentTitle}, version {trace.source.version}.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Inputs</h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {trace.inputs.map((input, i) => (
                  <tr key={`${input.name}-${i}`} className="border-t border-stone-100">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-stone-600">
                      {inputLabel(input.name)}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums text-stone-900">{traceValue(input.value)}</td>
                    <td className="py-2 text-right">
                      <ProvenanceBadge provenance={input.provenance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Formula</h3>
            <p className="mt-2 rounded-lg bg-stone-900 px-4 py-3 font-mono text-[13px] leading-6 text-stone-100">{trace.formula}</p>
            <p className="mt-1 font-mono text-[11px] text-stone-400">{trace.operation}</p>
          </section>

          {trace.assumptions.length > 0 ? (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Open assumptions</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {trace.assumptions.map((a) => (
                  <li key={a.code} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                    {a.text}
                    <span className="mt-1 block text-xs text-amber-800">{a.whatWouldResolveIt}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-xs leading-5 text-stone-500">
            A scenario estimate of the potential deductions covered by this simulation, based on the inputs shown. Not a guarantee of coverage, not a claim decision, and not advice.
          </p>
        </div>
      </aside>
    </div>
  );
}
