/**
 * Currency-safe arithmetic. Money is an integer number of paise; a Ratio is a
 * pair of non-negative integers. The only rounding in the engine happens in
 * mulRatio, half up at the paisa, once per operation.
 */

declare const moneyBrand: unique symbol;

/** Integer paise. Branded so a plain number cannot be passed by accident. */
export type Money = number & { readonly [moneyBrand]: true };

export interface Ratio {
  readonly num: number;
  readonly den: number;
}

export function paise(n: number): Money {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Money must be a safe integer number of paise, received ${String(n)}`);
  }
  return n as Money;
}

export const ZERO: Money = paise(0);

export function rupees(wholeRupees: number): Money {
  if (!Number.isSafeInteger(wholeRupees)) {
    throw new RangeError(`rupees() takes whole rupees, received ${String(wholeRupees)}`);
  }
  return paise(wholeRupees * 100);
}

export function add(a: Money, b: Money): Money {
  return paise(a + b);
}

export function sub(a: Money, b: Money): Money {
  return paise(a - b);
}

export function max0(a: Money): Money {
  return a < 0 ? ZERO : a;
}

export function sum(list: readonly Money[]): Money {
  return list.reduce<Money>((acc, m) => add(acc, m), ZERO);
}

export function times(a: Money, count: number): Money {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`times() needs a non-negative integer count, received ${String(count)}`);
  }
  return paise(a * count);
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function ratio(num: number, den: number): Ratio {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
    throw new RangeError(`ratio() needs integers, received ${String(num)}/${String(den)}`);
  }
  if (den <= 0) {
    throw new RangeError("ratio() needs a positive denominator");
  }
  if (num < 0) {
    throw new RangeError("ratio() needs a non-negative numerator");
  }
  if (num === 0) {
    return { num: 0, den: 1 };
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** A percentage such as 1 or 2.5, as an exact ratio (three decimal places of precision). */
export function percentToRatio(percent: number): Ratio {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new RangeError(`percentToRatio() needs a non-negative percent, received ${String(percent)}`);
  }
  return ratio(Math.round(percent * 1000), 100_000);
}

export function oneMinus(r: Ratio): Ratio {
  if (r.num > r.den) {
    throw new RangeError("oneMinus() needs a ratio no greater than 1");
  }
  return ratio(r.den - r.num, r.den);
}

/** a × r, rounded half up at the paisa (half away from zero for negative amounts). Exact integer arithmetic. */
export function mulRatio(a: Money, r: Ratio): Money {
  const sign = a < 0 ? -1n : 1n;
  const n = BigInt(Math.abs(a)) * BigInt(r.num);
  const d = BigInt(r.den);
  const q = (2n * n + d) / (2n * d);
  return paise(Number(sign * q));
}
