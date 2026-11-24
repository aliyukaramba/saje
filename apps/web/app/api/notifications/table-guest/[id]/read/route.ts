import { NextResponse } from "next/server";
import { findTableByToken, prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { token?: string; orderNumber?: string } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(token) || !/^SJ-[A-Z0-9-]{6,48}$/.test(orderNumber)) {
    return NextResponse.json({ error: "Invalid table notification request." }, { status: 400 });
  }
  const table = await findTableByToken(prisma, token);
  if (!table) return NextResponse.json({ error: "This table link is no longer valid." }, { status: 404 });
  const order = await prisma.order.findFirst({
    where: { orderNumber, session: { is: { tableId: table.id, status: { not: "CLOSED" } } } },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found for this table." }, { status: 404 });
  const notification = await prisma.notification.findFirst({
    where: { id, userId: null, channel: "IN_APP", relatedEntityType: "Order", relatedEntityId: order.id },
    select: { id: true, readAt: true },
  });
  if (!notification) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  return NextResponse.json({ success: true });
}
