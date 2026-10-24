"use client";

import { useEffect, useRef, useState } from "react";
import type { SimulationResult } from "@/engine/types";
import { questionSheet, questionSheetText } from "@/model/questions";
import { downloadText } from "./download";

interface Props {
  result: SimulationResult;
  onClose: () => void;
}

export function QuestionSheetDialog({ result, onClose }: Props) {
  const sheet = questionSheet(result);
  const text = questionSheetText(sheet, result);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      downloadText("claim-sach-question-sheet.txt", text);
    }
  };

  return (
    <div className="fixed inset-0 z-40 print:static print:z-auto" role="presentation">
      <button aria-label="Close the question sheet" className="absolute inset-0 bg-stone-900/30 print:hidden" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="qs-title" className="absolute inset-x-0 top-6 mx-auto flex max-h-[90vh] w-[min(44rem,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:static print:max-h-none print:w-full print:rounded-none print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4 print:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Question sheet</p>
            <h2 id="qs-title" className="mt-1 text-lg font-semibold text-stone-900">What to ask, and what it is worth</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">{copied ? "Copied" : "Copy"}</button>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">Print</button>
            <button type="button" onClick={() => downloadText("claim-sach-question-sheet.txt", text)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">Save .txt</button>
            <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">Close</button>
          </div>
        </header>
        <pre className="overflow-auto whitespace-pre-wrap px-6 py-5 font-sans text-[13px] leading-6 text-stone-800">{text}</pre>
      </div>
    </div>
  );
}
