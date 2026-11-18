import { describe, it, expect } from "vitest";
import { can, ROLE_PERMISSIONS } from "../src/permissions";

describe("role permissions", () => {
  it("kitchen staff can work the KDS but cannot manage payments", () => {
    expect(can("kitchen_staff", "kitchen:update")).toBe(true);
    expect(can("kitchen_staff", "payments:record")).toBe(false);
    expect(can("kitchen_staff", "payments:refund")).toBe(false);
  });

  it("cashiers can take payments but cannot change settings", () => {
    expect(can("cashier", "pos:sell")).toBe(true);
    expect(can("cashier", "payments:record")).toBe(true);
    expect(can("cashier", "settings:manage")).toBe(false);
  });

  it("inventory managers cannot touch refunds or settings", () => {
    expect(can("inventory_manager", "inventory:manage")).toBe(true);
    expect(can("inventory_manager", "payments:refund")).toBe(false);
    expect(can("inventory_manager", "settings:manage")).toBe(false);
  });

  it("super admins and restaurant managers manage settings", () => {
    const withSettings = (Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[])
      .filter((r) => can(r, "settings:manage"));
    expect(withSettings.sort()).toEqual(["restaurant_manager", "super_admin"].sort());
  });
});
