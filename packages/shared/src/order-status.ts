// Allowed order status transitions. Anything not listed is rejected.
// Cancellation is allowed from every non-terminal state.

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidStatusTransitionError extends Error {
  constructor(public readonly from: OrderStatus, public readonly to: OrderStatus) {
    super(`Invalid order status transition: ${from} -> ${to}`);
    this.name = "InvalidStatusTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidStatusTransitionError(from, to);
}

export function nextAllowedStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}
