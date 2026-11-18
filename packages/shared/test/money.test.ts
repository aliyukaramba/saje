import { describe, it, expect } from "vitest";
import { parseMajorToMinor, formatMinor, computeTotals } from "../src/money";

describe("money", () => {
  it("parses decimal strings exactly", () => {
    expect(parseMajorToMinor("1500")).toBe(150000n);
    expect(parseMajorToMinor("0.1")).toBe(10n);
    expect(parseMajorToMinor("19.99")).toBe(1999n);
  });

  it("rejects malformed amounts", () => {
    expect(() => parseMajorToMinor("1.234")).toThrow();
    expect(() => parseMajorToMinor("abc")).toThrow();
  });

  it("formats with naira symbol and grouping", () => {
    expect(formatMinor(123456789n)).toBe("₦1,234,567.89");
  });

  it("computes totals with discount, tax and delivery", () => {
    const totals = computeTotals(
      [
        { unitPrice: 300000n, quantity: 2, modifierTotal: 50000n }, // 7,000.00
        { unitPrice: 150000n, quantity: 1, modifierTotal: 0n },     // 1,500.00
      ],
      { discount: 85000n, taxRateBps: 750, deliveryFee: 150000n },
    );
    expect(totals.subtotal).toBe(850000n);
    expect(totals.discount).toBe(85000n);
    // discounted = 765000; tax = 7.5% = 57375
    expect(totals.tax).toBe(57375n);
    expect(totals.total).toBe(765000n + 57375n + 150000n);
  });

  it("never produces a negative total when discount exceeds subtotal", () => {
    const t = computeTotals([{ unitPrice: 1000n, quantity: 1, modifierTotal: 0n }], { discount: 5000n });
    expect(t.total).toBe(0n);
  });

  it("rejects non-positive quantities", () => {
    expect(() => computeTotals([{ unitPrice: 1000n, quantity: 0, modifierTotal: 0n }])).toThrow();
  });
});
