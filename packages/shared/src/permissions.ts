// Single source of truth for permission keys. Server code must call
// `can()` before any protected operation; the UI may hide controls, but
// hiding is never authorization on its own.

export const PERMISSIONS = [
  "orders:read",
  "orders:create",
  "orders:update_status",
  "orders:cancel",
  "kitchen:view",
  "kitchen:update",
  "pos:sell",
  "payments:record",
  "payments:verify_transfer",
  "payments:refund",
  "discounts:apply",
  "tables:manage",
  "tables:serve",
  "menu:manage",
  "inventory:manage",
  "customers:read",
  "reservations:manage",
  "delivery:assign",
  "delivery:update_own",
  "reports:read",
  "staff:manage",
  "settings:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = [
  "super_admin",
  "restaurant_manager",
  "cashier",
  "kitchen_staff",
  "waiter",
  "delivery_staff",
  "inventory_manager",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  super_admin: ALL,
  restaurant_manager: ALL,
  cashier: [
    "orders:read",
    "orders:create",
    "pos:sell",
    "payments:record",
    "payments:verify_transfer",
    "discounts:apply",
    "tables:serve",
    "customers:read",
  ],
  kitchen_staff: ["orders:read", "kitchen:view", "kitchen:update"],
  waiter: ["orders:read", "orders:create", "tables:serve", "tables:manage"],
  delivery_staff: ["orders:read", "delivery:update_own"],
  inventory_manager: ["inventory:manage", "reports:read"],
};

export function can(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(roles: readonly RoleKey[], permission: Permission): boolean {
  return roles.some((r) => can(r, permission));
}
