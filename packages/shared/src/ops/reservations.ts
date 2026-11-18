export interface Booking {
  id: string;
  tableId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "SEATED" | "COMPLETED" | "NO_SHOW";
}

const ACTIVE: ReadonlySet<Booking["status"]> = new Set(["PENDING", "CONFIRMED", "SEATED"]);

/** True if the candidate overlaps an active booking on the same table. Half-open intervals: [start, end). */
export function hasTableConflict(
  candidate: { tableId: string; startsAt: Date; endsAt: Date; excludeId?: string },
  bookings: readonly Booking[],
): boolean {
  return bookings.some(
    (b) =>
      b.id !== candidate.excludeId &&
      b.tableId === candidate.tableId &&
      ACTIVE.has(b.status) &&
      b.startsAt < candidate.endsAt &&
      candidate.startsAt < b.endsAt,
  );
}

/** Picks the smallest free table that seats the party. Returns null if none fits. */
export function assignTable(
  partySize: number,
  startsAt: Date,
  endsAt: Date,
  tables: readonly { id: string; capacity: number; isActive: boolean }[],
  bookings: readonly Booking[],
): string | null {
  const fit = tables
    .filter((t) => t.isActive && t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  for (const t of fit) {
    if (!hasTableConflict({ tableId: t.id, startsAt, endsAt }, bookings)) return t.id;
  }
  return null;
}
