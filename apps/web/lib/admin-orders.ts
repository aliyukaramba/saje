import { prisma } from "@restaurant/database";
import type { OrderCardData } from "../components/admin/OrderCard";
import type { OrderStatus } from "@restaurant/shared";

/** Loads open orders (not completed or cancelled) for the staff and kitchen screens. */
export async function loadOpenOrders(): Promise<OrderCardData[]> {
  const rows = await prisma.order.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: {
      items: { select: { quantity: true, nameSnapshot: true } },
      session: { select: { table: { select: { number: true } } } },
    },
    orderBy: [{ scheduledFor: "asc" }, { placedAt: "asc" }],
    take: 100,
  });
  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    paymentStatus: o.paymentStatus,
    guestName: o.guestName,
    scheduledFor: o.scheduledFor ? o.scheduledFor.toISOString() : null,
    total: `₦${Number(o.total.toString()).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
    items: o.items,
    type: o.type,
    notes: o.specialInstructions,
    tableNumber: o.session?.table.number ?? null,
  }));
}
