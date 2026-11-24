import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";

export type RangeKey = "today" | "7d" | "30d";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

// Nigeria is UTC+1 year-round. Days start at local midnight.
function startOfDayLagos(now: Date, daysBack: number): Date {
  const shifted = new Date(now.getTime() + 3600_000);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3600_000;
  return new Date(midnight - daysBack * 24 * 3600_000);
}

export function rangeStart(range: RangeKey, now = new Date()): Date {
  return startOfDayLagos(now, range === "today" ? 0 : range === "7d" ? 6 : 29);
}

const toMinor = (v: { toString(): string }): Minor => parseMajorToMinor(v.toString());

export async function loadReport(range: RangeKey) {
  const from = rangeStart(range);
  const [orders, payments, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { placedAt: { gte: from }, status: { not: "CANCELLED" } },
      include: { items: { select: { nameSnapshot: true, quantity: true, lineTotal: true } } },
      orderBy: { placedAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESSFUL", createdAt: { gte: from } },
      select: { method: true, amount: true },
    }),
    prisma.refund.findMany({
      where: { status: "SUCCESSFUL", createdAt: { gte: from } },
      select: { amount: true, payment: { select: { method: true } } },
    }),
  ]);

  const paid = orders.filter((o) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(o.paymentStatus));
  const salesMinor = paid.reduce<Minor>((s, o) => s + toMinor(o.total), 0n);
  const avgMinor = paid.length ? salesMinor / BigInt(paid.length) : 0n;

  const byType = new Map<string, { count: number; minor: Minor }>();
  for (const o of orders) {
    const key = o.type;
    const cur = byType.get(key) ?? { count: 0, minor: 0n };
    cur.count += 1;
    cur.minor += toMinor(o.total);
    byType.set(key, cur);
  }

  const byMethod = new Map<string, Minor>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0n) + toMinor(p.amount));

  // Refunds reduce the payment totals by method, and net sales.
  let refundsMinor = 0n;
  for (const r of refunds) {
    const v = toMinor(r.amount);
    refundsMinor += v;
    byMethod.set(r.payment.method, (byMethod.get(r.payment.method) ?? 0n) - v);
  }

  const dishes = new Map<string, { qty: number; minor: Minor }>();
  for (const o of paid) {
    for (const i of o.items) {
      const cur = dishes.get(i.nameSnapshot) ?? { qty: 0, minor: 0n };
      cur.qty += i.quantity;
      cur.minor += toMinor(i.lineTotal);
      dishes.set(i.nameSnapshot, cur);
    }
  }

  return {
    from,
    orders,
    paidCount: paid.length,
    salesMinor,
    refundsMinor,
    netMinor: salesMinor - refundsMinor,
    avgMinor,
    byType: [...byType.entries()].map(([type, v]) => ({ type, count: v.count, minor: v.minor })),
    byMethod: [...byMethod.entries()].map(([method, minor]) => ({ method, minor })),
    topDishes: [...dishes.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, minor: v.minor }))
      .sort((a, b) => (a.minor === b.minor ? 0 : a.minor > b.minor ? -1 : 1))
      .slice(0, 10),
  };
}

export { formatMinor };
