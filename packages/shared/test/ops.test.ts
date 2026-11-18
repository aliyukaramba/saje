import { describe, it, expect } from "vitest";
import { generateQrToken, hashQrToken, canOpenSession, canAddOrder, splitBill } from "../src/ops/tables";
import {
  canTransitionPayment, markGatewayPayment, recordOfflinePayment, derivePaymentStatus, claimWebhookEvent,
} from "../src/ops/payments";
import { planDeductions, applyDeductions, isLowStock } from "../src/ops/inventory";
import { hasTableConflict, assignTable } from "../src/ops/reservations";

describe("QR tokens and table sessions", () => {
  it("produces unique tokens and stores only hashes", () => {
    const t = generateQrToken();
    expect(generateQrToken()).not.toBe(t);
    expect(hashQrToken(t)).not.toContain(t);
  });

  it("allows only one non-closed session per table", () => {
    expect(canOpenSession([{ status: "CLOSED" }])).toBe(true);
    expect(canOpenSession([{ status: "OPEN" }])).toBe(false);
    expect(canOpenSession([{ status: "BILL_REQUESTED" }])).toBe(false);
  });

  it("only accepts orders while open", () => {
    expect(canAddOrder("OPEN")).toBe(true);
    expect(canAddOrder("BILL_REQUESTED")).toBe(false);
  });

  it("splits a bill exactly, distributing remainders", () => {
    const parts = splitBill(1000n, [
      { memberId: "a", weight: 1n }, { memberId: "b", weight: 1n }, { memberId: "c", weight: 1n },
    ]);
    const sum = parts.reduce((s, p) => s + p.amount, 0n);
    expect(sum).toBe(1000n);
    expect(parts.map((p) => p.amount).sort()).toEqual([333n, 333n, 334n]);
  });

  it("splits proportionally to weights", () => {
    const parts = splitBill(3000n, [{ memberId: "a", weight: 2000n }, { memberId: "b", weight: 1000n }]);
    expect(parts).toEqual([{ memberId: "a", amount: 2000n }, { memberId: "b", amount: 1000n }]);
  });

  it("rejects empty splits", () => {
    expect(() => splitBill(100n, [])).toThrow();
    expect(() => splitBill(100n, [{ memberId: "a", weight: 0n }])).toThrow(/Nothing/);
  });
});

describe("payments", () => {
  it("never sets Topify success from a browser redirect", () => {
    expect(() => markGatewayPayment("PENDING", "SUCCESSFUL", "redirect")).toThrow(/redirect/);
    expect(markGatewayPayment("PENDING", "SUCCESSFUL", "gateway_verify")).toBe("SUCCESSFUL");
  });

  it("blocks invalid gateway transitions", () => {
    expect(canTransitionPayment("FAILED", "SUCCESSFUL")).toBe(false);
    expect(() => markGatewayPayment("FAILED", "SUCCESSFUL", "gateway_webhook")).toThrow();
  });

  it("records cash as successful and bank transfers as pending until verified", () => {
    expect(recordOfflinePayment("CASH", { amount: 100n, reference: "R1" }).status).toBe("SUCCESSFUL");
    expect(recordOfflinePayment("BANK_TRANSFER", { amount: 100n, reference: "R2" }).status).toBe("PENDING");
    expect(recordOfflinePayment("BANK_TRANSFER", { amount: 100n, reference: "R2", bankState: "VERIFIED" }).status).toBe("SUCCESSFUL");
  });

  it("requires terminal info for POS entries", () => {
    expect(() => recordOfflinePayment("POS_TERMINAL", { amount: 100n, reference: "R3" })).toThrow(/Terminal/);
  });

  it("derives order payment status across partial payments and refunds", () => {
    expect(derivePaymentStatus(1000n, [])).toBe("UNPAID");
    expect(derivePaymentStatus(1000n, [{ status: "SUCCESSFUL", amount: 400n, refunded: 0n }])).toBe("PARTIALLY_PAID");
    expect(derivePaymentStatus(1000n, [{ status: "SUCCESSFUL", amount: 1000n, refunded: 0n }])).toBe("PAID");
    expect(derivePaymentStatus(1000n, [{ status: "PARTIALLY_REFUNDED", amount: 1000n, refunded: 200n }])).toBe("PARTIALLY_REFUNDED");
    expect(derivePaymentStatus(1000n, [{ status: "REFUNDED", amount: 1000n, refunded: 1000n }])).toBe("REFUNDED");
  });

  it("ignores duplicate webhook deliveries", () => {
    const seen = new Set<string>();
    expect(claimWebhookEvent(seen, "topify", "evt_1")).toBe(true);
    expect(claimWebhookEvent(seen, "topify", "evt_1")).toBe(false);
  });
});

describe("inventory deductions", () => {
  const recipe = [
    { inventoryItemId: "chicken", quantity: 200 },
    { inventoryItemId: "rice", quantity: 150 },
  ];

  it("deducts recipe quantities times the number sold", () => {
    const plan = planDeductions("o1", "l1", 3, recipe);
    expect(plan.map((d) => d.quantity)).toEqual([600, 450]);
  });

  it("does not deduct twice when an order line is processed again", () => {
    const stock = new Map([["chicken", 1000], ["rice", 1000]]);
    const applied = new Set<string>();
    const plan = planDeductions("o1", "l1", 1, recipe);
    applyDeductions(stock, plan, applied);
    const second = applyDeductions(stock, plan, applied);
    expect(second.skipped.length).toBe(2);
    expect(stock.get("chicken")).toBe(800);
  });

  it("reports shortfalls and never goes below zero", () => {
    const stock = new Map([["chicken", 100], ["rice", 1000]]);
    const result = applyDeductions(stock, planDeductions("o2", "l2", 1, recipe), new Set());
    expect(result.shortfalls).toEqual([{ inventoryItemId: "chicken", missing: 100 }]);
    expect(stock.get("chicken")).toBe(0);
  });

  it("flags low stock at or below the reorder level", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe("reservations", () => {
  const t0 = new Date("2026-12-01T18:00:00Z");
  const t1 = new Date("2026-12-01T20:00:00Z");
  const existing = [{ id: "r1", tableId: "T1", startsAt: t0, endsAt: t1, status: "CONFIRMED" as const }];

  it("detects overlapping bookings on the same table", () => {
    const overlapping = { tableId: "T1", startsAt: new Date("2026-12-01T19:00:00Z"), endsAt: new Date("2026-12-01T21:00:00Z") };
    expect(hasTableConflict(overlapping, existing)).toBe(true);
  });

  it("allows back-to-back bookings", () => {
    const after = { tableId: "T1", startsAt: t1, endsAt: new Date("2026-12-01T22:00:00Z") };
    expect(hasTableConflict(after, existing)).toBe(false);
  });

  it("ignores rejected or cancelled bookings", () => {
    const cancelled = [{ ...existing[0], status: "CANCELLED" as const }];
    expect(hasTableConflict({ tableId: "T1", startsAt: t0, endsAt: t1 }, cancelled)).toBe(false);
  });

  it("assigns the smallest table that fits and is free", () => {
    const tables = [
      { id: "big", capacity: 8, isActive: true },
      { id: "small", capacity: 2, isActive: true },
      { id: "mid", capacity: 4, isActive: true },
    ];
    expect(assignTable(3, t0, t1, tables, [])).toBe("mid");
    expect(assignTable(3, t0, t1, tables, [{ ...existing[0], tableId: "mid" }])).toBe("big");
    expect(assignTable(20, t0, t1, tables, [])).toBeNull();
  });
});
