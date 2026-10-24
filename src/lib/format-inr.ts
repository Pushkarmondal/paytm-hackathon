/**
 * Indian-rupee formatting for amounts held as integer paise.
 *
 * Whole rupees by default (tables, headlines); paise on request (traces).
 * Rounding to the rupee is half up, which matches the engine's rounding rule.
 */

const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface FormatInrOptions {
  /** Show two decimal places (paise). Default: false. */
  paise?: boolean;
}

export function formatInr(paise: number, options: FormatInrOptions = {}): string {
  if (!Number.isSafeInteger(paise)) {
    throw new TypeError(`formatInr expects integer paise, received ${String(paise)}`);
  }
  if (options.paise) {
    return withPaise.format(paise / 100);
  }
  const sign = paise < 0 ? -1 : 1;
  const magnitude = Math.abs(paise);
  const rupees = Math.floor((magnitude + 50) / 100);
  return wholeRupees.format(sign * rupees);
}
