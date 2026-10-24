import type { Money } from "@/engine/money";
import type { IssuerInfo, Provenance, Range, TraceValue } from "@/engine/types";
import { formatInr } from "@/lib/format-inr";

/** Whole rupees by default (tables, headlines). `precise` shows paise where they exist (traces). */
export function money(paise: Money | number, precise = false): string {
  return formatInr(paise, { paise: precise && paise % 100 !== 0 });
}

export function signedMoney(paise: Money | number): string {
  if (paise === 0) return "No change";
  return `${paise > 0 ? "+" : "−"}${money(Math.abs(paise))}`;
}

export function rangeText(range: Range, precise = false): string {
  return `${money(range.low, precise)} to ${money(range.high, precise)}`;
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  fixture: "From the demo documents",
  upload: "From your upload",
  userConfirmed: "Confirmed by you",
  userEntered: "Entered by you",
};

const INPUT_LABELS: Record<string, string> = {
  ratePerDay: "Room rate per day",
  eligiblePerDay: "Eligible rate per day",
  days: "Days",
  sumInsured: "Sum insured",
  percentPerDay: "Limit per day, as % of sum insured",
  fixedPerDay: "Fixed limit per day",
  itemAmount: "Item amount",
  ratio: "Eligible ÷ actual room rate",
  hospitalFollowsDifferentialBilling: "Hospital follows differential billing",
  scheduleStatedLimit: "Limit printed on the schedule",
  scheduleText: "Schedule text",
  category: "Category",
  classification: "Classification",
  wording: "Wording",
  icuCharges: "ICU charges",
};

export function inputLabel(name: string): string {
  return INPUT_LABELS[name] ?? name;
}

export function traceValue(value: TraceValue): string {
  switch (value.kind) {
    case "money":
      return money(value.paise, true);
    case "days":
      return `${value.days} day${value.days === 1 ? "" : "s"}`;
    case "ratio":
      return `${value.ratio.num}/${value.ratio.den}`;
    case "percent":
      return `${value.percent}%`;
    case "text":
      return value.text;
    case "boolean":
      return value.value ? "Yes" : "No";
  }
}

export function issuerLabel(issuer: IssuerInfo): string {
  return issuer.kind === "synthetic" ? "Synthetic demo policy. Not issued by any insurer." : `Issued by ${issuer.name}`;
}
