"use client";

import type { SimulationResult, UncertaintyReason } from "@/engine/types";
import type { UncertaintyGroups } from "@/model";
import { rangeText } from "../format";

interface Props {
  result: SimulationResult;
  groups: UncertaintyGroups;
  onGoToReview: () => void;
}

const GROUPS: { key: keyof Pick<UncertaintyGroups, "user" | "hospital" | "insurer" | "none">; title: string; blurb: string; tone: string }[] = [
  { key: "user", title: "You can resolve this now", blurb: "Confirm or classify on Input review. Your answer is recorded as yours in every trace.", tone: "border-emerald-200" },
  { key: "hospital", title: "Ask the hospital", blurb: "A fact about billing practice that only the hospital can state.", tone: "border-amber-200" },
  { key: "insurer", title: "Requires insurer confirmation", blurb: "The wording is silent or ambiguous here. Only the insurer can settle it.", tone: "border-sky-200" },
  { key: "none", title: "Cannot be resolved from these documents", blurb: "No document or confirmation available to this simulator settles it.", tone: "border-stone-300" },
];

function Reason({ reason, result, onGoToReview }: { reason: UncertaintyReason; result: SimulationResult; onGoToReview: () => void }) {
  const labels = reason.affectedItemIds.map((id) => result.items.find((i) => i.itemId === id)?.label ?? id);
  return (
    <li className="rounded-lg bg-white px-4 py-3">
      <p className="text-sm leading-6 text-stone-900">{reason.text}</p>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-stone-600">
        {labels.length > 0 ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-stone-500">Affects</dt>
            <dd>{labels.join(", ")}</dd>
          </div>
        ) : null}
        {reason.amountAtStake ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-stone-500">At stake</dt>
            <dd className="tabular-nums">
              {rangeText(reason.amountAtStake)} <span className="text-stone-400">· {reason.amountAtStake.basis}</span>
            </dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-stone-500">Resolves it</dt>
          <dd>{reason.whatWouldResolveIt}</dd>
        </div>
      </dl>
      {reason.resolvableBy === "user" ? (
        <button type="button" onClick={onGoToReview} className="mt-3 inline-flex h-8 items-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2">
          Resolve on Input review
        </button>
      ) : null}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-stone-400">{reason.code}</p>
    </li>
  );
}

export function UncertaintyScreen({ result, groups, onGoToReview }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-stone-500">What remains uncertain</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
          {groups.total === 0 ? "Everything shown was established from the documents." : `${groups.total} open ${groups.total === 1 ? "question" : "questions"} for the planned room`}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
          Nothing here is folded into a total. Each entry says what is missing, what it affects, and who can settle it. Below them is the list of policy terms this version does not model at all.
        </p>
      </div>

      {GROUPS.map((g) => {
        const items = groups[g.key];
        if (items.length === 0) return null;
        return (
          <section key={g.key} className={`rounded-xl border bg-stone-50 p-4 ${g.tone}`}>
            <h2 className="text-base font-semibold text-stone-900">{g.title}</h2>
            <p className="mt-0.5 text-sm text-stone-600">{g.blurb}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((reason) => (
                <Reason key={reason.code} reason={reason} result={result} onGoToReview={onGoToReview} />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">Not modelled by this version</h2>
        <p className="mt-0.5 text-sm text-stone-600">
          These terms can change what you pay. The simulator does not evaluate them, which is why its result is never your total out-of-pocket cost.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {groups.notModelled.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-stone-800">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
