import { NextResponse } from "next/server";
import { findTableByToken, prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; orders?: string[] } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const orderNumbers = Array.isArray(body?.orders) ? body.orders.filter((value): value is string => typeof value === "string").slice(0, 20) : [];
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(token) || orderNumbers.some(value => !/^SJ-[A-Z0-9-]{6,48}$/.test(value))) {
    return NextResponse.json({ error: "Invalid table notification request." }, { status: 400 });
  }
  const table = await findTableByToken(prisma, token);
  if (!table) return NextResponse.json({ error: "This table link is no longer valid." }, { status: 404 });
  if (!orderNumbers.length) return NextResponse.json({ notifications: [] });

  const orders = await prisma.order.findMany({
    where: { orderNumber: { in: [...new Set(orderNumbers)] }, session: { is: { tableId: table.id, status: { not: "CLOSED" } } } },
    select: { id: true, orderNumber: true },
  });
  if (!orders.length) return NextResponse.json({ notifications: [] });
  const orderNumberById = new Map(orders.map(order => [order.id, order.orderNumber]));
  const notifications = await prisma.notification.findMany({
    where: {
      userId: null,
      channel: "IN_APP",
      relatedEntityType: "Order",
      relatedEntityId: { in: orders.map(order => order.id) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, type: true, priority: true, readAt: true, createdAt: true, relatedEntityId: true },
  });
  return NextResponse.json({
    notifications: notifications.map(({ relatedEntityId, ...item }) => ({
      ...item,
      orderNumber: relatedEntityId ? orderNumberById.get(relatedEntityId) ?? "" : "",
    })),
  });
}
