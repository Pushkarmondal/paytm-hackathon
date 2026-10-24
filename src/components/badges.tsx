import type { IssuerInfo, Provenance, ResultState } from "@/engine/types";
import { stateLabel } from "@/model";
import { PROVENANCE_LABEL } from "./format";

const STATE_CLASS: Record<ResultState, string> = {
  calculated: "bg-stone-900 text-white",
  conditional: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  unknown: "bg-stone-100 text-stone-600 ring-1 ring-dashed ring-stone-400",
  excluded: "bg-stone-100 text-stone-500",
  requiresInsurerConfirmation: "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
  reviewRequired: "bg-rose-100 text-rose-900 ring-1 ring-rose-300",
};

export function StateBadge({ state, className = "" }: { state: ResultState; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${STATE_CLASS[state]} ${className}`}
    >
      {stateLabel(state)}
    </span>
  );
}

const PROVENANCE_CLASS: Record<Provenance, string> = {
  fixture: "text-stone-500 ring-stone-300",
  upload: "text-stone-700 ring-stone-400",
  userConfirmed: "text-emerald-800 ring-emerald-300 bg-emerald-50",
  userEntered: "text-emerald-800 ring-emerald-300 bg-emerald-50",
};

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ${PROVENANCE_CLASS[provenance]}`}>
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}

export function IssuerBadge({ issuer }: { issuer: IssuerInfo }) {
  if (issuer.kind === "synthetic") {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 ring-1 ring-violet-200"
        title={issuer.label}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-violet-500" />
        Synthetic demo policy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800 ring-1 ring-stone-200">
      Insurer-issued: {issuer.name}
    </span>
  );
}
