import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { requestStaff } from "../../../../lib/staff-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = await requestStaff(request, "orders:read");
  if (!staff) return NextResponse.json({ error: "You do not have permission to view orders." }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: {
      items: { select: { quantity: true, nameSnapshot: true, notes: true, modifiers: { select: { nameSnapshot: true } } } },
      session: { select: { table: { select: { number: true } } } },
    },
    orderBy: [{ placedAt: "asc" }],
    take: 100,
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      type: order.type,
      guestName: order.guestName,
      tableNumber: order.session?.table.number ?? null,
      total: `₦${Number(order.total.toString()).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      placedAt: order.placedAt.toISOString(),
      items: order.items.map((item) => ({ name: item.nameSnapshot, quantity: item.quantity, notes: item.notes, modifiers: item.modifiers.map((modifier) => modifier.nameSnapshot) })),
    })),
  });
}
