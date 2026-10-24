"use client";

import { useId, useState } from "react";
import { MAX_UPLOAD_BYTES, readUpload, type UploadKind } from "@/ingestion";
import type { Action, Uploads, AppState } from "@/model";
import { ProvenanceBadge } from "./badges";

interface Props {
  uploads: Uploads;
  errors: AppState["uploadErrors"];
  dispatch: (action: Action) => void;
}

const ROWS: { kind: UploadKind; label: string; hint: string; accept: string }[] = [
  { kind: "ruleset", label: "Policy wording as a Claim Sach ruleset", hint: "JSON. Clauses with ids and full text, plus the rules that cite them. Rejected if any rule misquotes its clause.", accept: ".json,application/json" },
  { kind: "schedule", label: "Policy schedule", hint: "JSON. Sum insured, period, and any limits printed on the schedule.", accept: ".json,application/json" },
  { kind: "estimate", label: "Hospital estimate", hint: "JSON for a full estimate, or a CSV of line items with the columns label, category, amount_rupees (optionally days, rate_per_day_rupees).", accept: ".json,.csv,application/json,text/csv" },
];

async function handleFile(kind: UploadKind, file: File, dispatch: Props["dispatch"]) {
  let text = "";
  try {
    if (file.size <= MAX_UPLOAD_BYTES) text = await file.text();
  } catch {
    dispatch({ type: "uploadFailed", target: kind, fileName: file.name, message: "The file could not be read." });
    return;
  }
  const result = readUpload({ name: file.name, size: file.size, text }, kind);
  if (!result.ok) {
    dispatch({ type: "uploadFailed", target: kind, fileName: file.name, message: result.error.message });
    return;
  }
  switch (result.kind) {
    case "ruleset":
      dispatch({ type: "uploadRuleset", ruleset: result.value, fileName: file.name, warnings: result.warnings });
      break;
    case "schedule":
      dispatch({ type: "uploadSchedule", schedule: result.value, fileName: file.name, warnings: result.warnings });
      break;
    case "estimate":
      dispatch({ type: "uploadEstimate", estimate: result.value, fileName: file.name, warnings: result.warnings });
      break;
    case "estimateItems":
      dispatch({ type: "uploadEstimateItems", items: result.value.items, fileName: file.name, warnings: result.warnings });
      break;
  }
}

function UploadRow({ kind, label, hint, accept, uploads, errors, dispatch }: (typeof ROWS)[number] & Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const record = uploads[kind];
  const error = errors[kind];
  const itemsOnly = kind === "estimate" && uploads.estimate?.kind === "items";
  return (
    <div className="flex flex-col gap-2 border-t border-stone-100 py-4 first:border-t-0 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div className="lg:max-w-md">
        <label htmlFor={id} className="text-sm font-medium text-stone-900">
          {label}
        </label>
        <p className="mt-0.5 text-xs leading-5 text-stone-500">{hint}</p>
      </div>
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              await handleFile(kind, file, dispatch);
            } finally {
              setBusy(false);
            }
          }}
          className="block text-sm text-stone-700 file:mr-3 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-900 hover:file:bg-stone-50"
        />
        {record ? (
          <div className="flex flex-col items-start gap-1 lg:items-end">
            <span className="inline-flex items-center gap-2 text-xs text-stone-700">
              <span className="font-medium">{record.fileName}</span>
              <ProvenanceBadge provenance="upload" />
              {itemsOnly ? <span className="text-stone-500">line items only; room options and days stay from the demo</span> : null}
            </span>
            {record.warnings.length > 0 ? (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                {record.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="max-w-md rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-950">
            <span className="font-medium">{error.fileName}</span> was not used. {error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function UploadSection({ uploads, errors, dispatch }: Props) {
  const any = Boolean(uploads.ruleset || uploads.schedule || uploads.estimate);
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Your own documents</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Replace a demo document with your own. Files are read in this browser only and never sent anywhere. Up to {MAX_UPLOAD_BYTES / (1024 * 1024)} MB each; JSON or CSV. Extracted values appear below for review before they are used.
          </p>
        </div>
        {any ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "clearUploads" })}
            className="inline-flex h-8 items-center rounded-lg border border-stone-300 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            Clear uploads
          </button>
        ) : null}
      </div>
      <div className="mt-2">
        {ROWS.map((row) => (
          <UploadRow key={row.kind} {...row} uploads={uploads} errors={errors} dispatch={dispatch} />
        ))}
      </div>
    </section>
  );
}
