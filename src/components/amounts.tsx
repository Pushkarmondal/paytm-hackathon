import type { Range, TraceOutput } from "@/engine/types";
import { money, rangeText } from "./format";

export function Amount({ paise, className = "", precise = false }: { paise: number; className?: string; precise?: boolean }) {
  return <span className={`tabular-nums ${className}`}>{money(paise, precise)}</span>;
}

export function RangeAmount({ range, className = "", precise = false }: { range: Range; className?: string; precise?: boolean }) {
  return <span className={`tabular-nums ${className}`}>{rangeText(range, precise)}</span>;
}

/** The dash that stands for an unknown amount. Never a zero. */
export function Unknown({ label = "Cannot determine" }: { label?: string }) {
  return (
    <span className="tabular-nums text-stone-400" aria-label={label} title={label}>
      —
    </span>
  );
}

export function OutputAmount({ output, className = "", precise = false }: { output: TraceOutput; className?: string; precise?: boolean }) {
  if (output.state === "conditional" && output.range) {
    return <RangeAmount range={output.range} className={className} precise={precise} />;
  }
  if (output.value === null) {
    return <Unknown />;
  }
  return <Amount paise={output.value} className={className} precise={precise} />;
}
