import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, InvalidStatusTransitionError } from "../src/order-status";

describe("order status transitions", () => {
  it("follows the happy path in order", () => {
    const path = ["PENDING", "CONFIRMED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("rejects skipping steps", () => {
    expect(canTransition("PENDING", "PREPARING")).toBe(false);
    expect(canTransition("CONFIRMED", "READY")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("PREPARING", "ACCEPTED")).toBe(false);
  });

  it("allows cancellation from any non-terminal state", () => {
    for (const s of ["PENDING", "CONFIRMED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });

  it("treats completed and cancelled as terminal", () => {
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("throws a typed error on invalid transitions", () => {
    expect(() => assertTransition("PENDING", "READY")).toThrow(InvalidStatusTransitionError);
  });
});
