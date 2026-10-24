"use client";

import type { ReactNode } from "react";
import type { IssuerInfo } from "@/engine/types";
import type { Screen } from "@/model";
import { IssuerBadge } from "./badges";

const TABS: { id: Screen; label: string; short: string }[] = [
  { id: "overview", label: "Scenario overview", short: "Overview" },
  { id: "twin", label: "Coverage Twin", short: "Twin" },
  { id: "why", label: "Why this changed", short: "Why" },
  { id: "uncertainty", label: "What remains uncertain", short: "Uncertain" },
  { id: "review", label: "Input review", short: "Inputs" },
];

interface Props {
  screen: Screen;
  issuer: IssuerInfo;
  uncertaintyCount: number;
  onScreen: (screen: Screen) => void;
  onReset: () => void;
  children: ReactNode;
}

export const DISCLAIMER =
  "This is a scenario estimate of the potential deductions covered by this simulation, based on the inputs shown. It is not your total out-of-pocket cost: policy terms this version does not model are listed under What remains uncertain. It is not a guarantee of coverage, not a claim decision, and not advice. Your insurer's final determination may differ. Confirm with your insurer and hospital before admission.";

export function Shell({ screen, issuer, uncertaintyCount, onScreen, onReset, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="whitespace-nowrap text-base font-semibold tracking-tight text-stone-900">Claim Sach</span>
            <span className="hidden text-sm text-stone-400 sm:inline">/</span>
            <span className="hidden text-sm text-stone-600 sm:inline">Coverage Twin</span>
          </div>
          <div className="flex items-center gap-2">
            <IssuerBadge issuer={issuer} />
            <button
              type="button"
              onClick={() => onScreen("uncertainty")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              aria-label={`${uncertaintyCount} open uncertainties. Open the uncertainty panel.`}
            >
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${uncertaintyCount > 0 ? "bg-amber-500" : "bg-stone-300"}`} />
              Uncertain <span className="tabular-nums">{uncertaintyCount}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-xs font-medium text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              Reset to demo
            </button>
          </div>
        </div>
        <nav aria-label="Screens" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active = tab.id === screen;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onScreen(tab.id)}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                      active ? "border-stone-900 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <span className="sm:hidden">{tab.short}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <p className="border-t border-stone-200 pt-4 text-xs leading-5 text-stone-500">{DISCLAIMER}</p>
      </footer>
    </div>
  );
}
