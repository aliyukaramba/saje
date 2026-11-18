// Money is handled in integer minor units (kobo for NGN) to avoid floating-point
// drift. Persisted values use Prisma Decimal(12,2); convert at the boundary.

export type Minor = bigint;

const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function parseMajorToMinor(value: string): Minor {
  if (!DECIMAL_PATTERN.test(value)) throw new Error(`Invalid money amount: ${value}`);
  const negative = value.startsWith("-");
  const [whole, frac = ""] = value.replace("-", "").split(".");
  const minor = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  return negative ? -minor : minor;
}

export function formatMinor(amount: Minor, currency = "NGN"): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = currency === "NGN" ? "₦" : `${currency} `;
  return `${negative ? "-" : ""}${symbol}${grouped}.${frac}`;
}

export interface PricedLine {
  unitPrice: Minor;
  quantity: number;
  modifierTotal: Minor;
}

export interface Totals {
  subtotal: Minor;
  discount: Minor;
  tax: Minor;
  deliveryFee: Minor;
  total: Minor;
}

/**
 * Cart totals. Tax is computed on the discounted subtotal and rounded half-up
 * to the nearest minor unit. Total is never negative.
 */
export function computeTotals(
  lines: readonly PricedLine[],
  opts: { discount?: Minor; taxRateBps?: number; deliveryFee?: Minor } = {},
): Totals {
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
    if (line.unitPrice < 0n || line.modifierTotal < 0n) {
      throw new Error("Prices cannot be negative");
    }
  }
  const subtotal = lines.reduce(
    (sum, l) => sum + (l.unitPrice + l.modifierTotal) * BigInt(l.quantity),
    0n,
  );
  const discount = opts.discount ?? 0n;
  if (discount < 0n) throw new Error("Discount cannot be negative");
  const discounted = subtotal - discount > 0n ? subtotal - discount : 0n;
  const taxRateBps = BigInt(opts.taxRateBps ?? 0); // basis points: 750 = 7.5%
  const tax = (discounted * taxRateBps + 5000n) / 10000n;
  const deliveryFee = opts.deliveryFee ?? 0n;
  const total = discounted + tax + deliveryFee;
  return {
    subtotal,
    discount: subtotal - discounted,
    tax,
    deliveryFee,
    total,
  };
}
