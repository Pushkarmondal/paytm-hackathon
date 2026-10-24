import { describe, expect, it } from "vitest";
import {
  add,
  max0,
  mulRatio,
  oneMinus,
  paise,
  ratio,
  rupees,
  sub,
  sum,
} from "@/engine/money";

describe("Money is integer paise", () => {
  it("accepts safe integers and rejects anything else", () => {
    expect(paise(0)).toBe(0);
    expect(paise(133_333)).toBe(133_333);
    expect(() => paise(1.5)).toThrow();
    expect(() => paise(Number.NaN)).toThrow();
    expect(() => paise(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => paise(2 ** 53)).toThrow();
  });

  it("converts whole rupees to paise exactly", () => {
    expect(rupees(500_000)).toBe(50_000_000);
    expect(rupees(0)).toBe(0);
    expect(() => rupees(1333.33)).toThrow();
  });

  it("adds, subtracts and sums without drift", () => {
    expect(add(paise(1), paise(2))).toBe(3);
    expect(sub(paise(5), paise(7))).toBe(-2);
    expect(max0(sub(paise(5), paise(7)))).toBe(0);
    expect(sum([rupees(30_000), rupees(15_000), rupees(4_000)])).toBe(rupees(49_000));
    expect(sum([])).toBe(0);
  });
});

describe("Ratio", () => {
  it("normalises by the greatest common divisor", () => {
    expect(ratio(5_000, 7_500)).toEqual({ num: 2, den: 3 });
    expect(ratio(5_000, 12_000)).toEqual({ num: 5, den: 12 });
    expect(ratio(5_000, 5_000)).toEqual({ num: 1, den: 1 });
  });

  it("rejects non-positive denominators and negative numerators", () => {
    expect(() => ratio(1, 0)).toThrow();
    expect(() => ratio(-1, 2)).toThrow();
    expect(() => ratio(1.5, 2)).toThrow();
  });

  it("computes one minus a proper ratio", () => {
    expect(oneMinus(ratio(2, 3))).toEqual({ num: 1, den: 3 });
    expect(oneMinus(ratio(5, 12))).toEqual({ num: 7, den: 12 });
    expect(oneMinus(ratio(1, 1))).toEqual({ num: 0, den: 1 });
    expect(() => oneMinus(ratio(4, 3))).toThrow();
  });
});

describe("mulRatio rounds half up at the paisa, once", () => {
  it("matches the demo fixture's per-item deductions at ratio 2/3", () => {
    const keep = ratio(5_000, 7_500);
    const cut = oneMinus(keep);
    expect(mulRatio(rupees(4_000), cut)).toBe(133_333);
    expect(mulRatio(rupees(60_000), cut)).toBe(2_000_000);
    expect(mulRatio(rupees(15_000), cut)).toBe(500_000);
    expect(mulRatio(rupees(35_000), cut)).toBe(1_166_667);
    expect(
      sum([
        mulRatio(rupees(4_000), cut),
        mulRatio(rupees(60_000), cut),
        mulRatio(rupees(15_000), cut),
        mulRatio(rupees(35_000), cut),
      ]),
    ).toBe(rupees(38_000));
  });

  it("matches the demo fixture at ratio 5/12", () => {
    const cut = oneMinus(ratio(5_000, 12_000));
    expect(mulRatio(rupees(4_000), cut)).toBe(233_333);
    expect(mulRatio(rupees(60_000), cut)).toBe(3_500_000);
    expect(mulRatio(rupees(15_000), cut)).toBe(875_000);
    expect(mulRatio(rupees(35_000), cut)).toBe(2_041_667);
  });

  it("rounds exact halves up", () => {
    expect(mulRatio(paise(150), ratio(1, 100))).toBe(2);
    expect(mulRatio(paise(250), ratio(1, 100))).toBe(3);
    expect(mulRatio(paise(149), ratio(1, 100))).toBe(1);
  });

  it("is exact for large amounts (no floating-point drift)", () => {
    expect(mulRatio(rupees(1_000_000_000), ratio(1, 3))).toBe(33_333_333_333);
    expect(mulRatio(rupees(1), ratio(1, 100))).toBe(1);
  });

  it("applies percent-of-sum-insured limits exactly", () => {
    expect(mulRatio(rupees(500_000), ratio(1, 100))).toBe(rupees(5_000));
    expect(mulRatio(rupees(500_000), ratio(2, 100))).toBe(rupees(10_000));
  });
});
