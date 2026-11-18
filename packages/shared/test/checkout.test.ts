import { describe, it, expect } from "vitest";
import { validateFulfilment } from "../src/checkout";
import { CatalogError } from "../src/catalog/pricing";

const now = new Date("2026-11-18T14:00:00Z");
const zone = { id: "z1", fee: 150000n, minOrderAmount: 1000000n, isActive: true };
const base = { subtotal: 2000000n, deliveryEnabled: true, pickupEnabled: true, now, pickupLeadMinutes: 20 };

describe("fulfilment", () => {
  it("prices delivery from the zone", () => {
    const r = validateFulfilment({ ...base, type: "DELIVERY", zone });
    expect(r.deliveryFee).toBe(150000n);
    expect(r.zoneId).toBe("z1");
  });

  it("rejects delivery below the zone minimum", () => {
    expect(() => validateFulfilment({ ...base, subtotal: 500000n, type: "DELIVERY", zone })).toThrow(CatalogError);
  });

  it("rejects addresses outside an active zone", () => {
    expect(() => validateFulfilment({ ...base, type: "DELIVERY", zone: null })).toThrow(/do not deliver/);
    expect(() => validateFulfilment({ ...base, type: "DELIVERY", zone: { ...zone, isActive: false } })).toThrow();
  });

  it("respects the delivery switch", () => {
    expect(() => validateFulfilment({ ...base, deliveryEnabled: false, type: "DELIVERY", zone })).toThrow(/not available/);
  });

  it("requires pickup times at least the lead time away", () => {
    const tooSoon = new Date(now.getTime() + 5 * 60_000);
    expect(() => validateFulfilment({ ...base, type: "PICKUP", pickupAt: tooSoon })).toThrow(/at least 20/);
    const ok = new Date(now.getTime() + 30 * 60_000);
    expect(validateFulfilment({ ...base, type: "PICKUP", pickupAt: ok }).scheduledFor).toEqual(ok);
  });

  it("respects the pickup switch", () => {
    expect(() => validateFulfilment({ ...base, pickupEnabled: false, type: "PICKUP", pickupAt: now })).toThrow(/not available/);
  });
});
