import { describe, expect, it } from "vitest";
import { formatInr } from "@/lib/format-inr";

describe("formatInr (amounts are integer paise)", () => {
  it("formats whole rupees with Indian lakh/crore grouping", () => {
    expect(formatInr(32_350_000)).toBe("₹3,23,500");
    expect(formatInr(50_000_000)).toBe("₹5,00,000");
    expect(formatInr(1_000_000_000)).toBe("₹1,00,00,000");
  });

  it("formats zero as ₹0, never as blank", () => {
    expect(formatInr(0)).toBe("₹0");
  });

  it("rounds half up to the rupee when paise are hidden", () => {
    expect(formatInr(133_333)).toBe("₹1,333");
    expect(formatInr(1_166_667)).toBe("₹11,667");
    expect(formatInr(50)).toBe("₹1");
    expect(formatInr(49)).toBe("₹0");
  });

  it("shows paise on request", () => {
    expect(formatInr(133_333, { paise: true })).toBe("₹1,333.33");
    expect(formatInr(32_350_000, { paise: true })).toBe("₹3,23,500.00");
  });

  it("formats negative amounts (deltas) with a leading minus", () => {
    expect(formatInr(-500_000)).toBe("-₹5,000");
  });

  it("refuses non-integer or unsafe inputs instead of guessing", () => {
    expect(() => formatInr(1.5)).toThrow();
    expect(() => formatInr(Number.NaN)).toThrow();
    expect(() => formatInr(Number.MAX_SAFE_INTEGER + 2)).toThrow();
  });
});
