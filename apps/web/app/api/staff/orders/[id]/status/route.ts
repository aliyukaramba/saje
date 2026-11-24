import { NextResponse } from "next/server";
import { prisma, deductForOrder } from "@restaurant/database";
import { canTransition, ORDER_STATUSES, type OrderStatus } from "@restaurant/shared";
import { requestStaff } from "../../../../../../lib/staff-api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requestStaff(request, "kitchen:update");
  if (!staff) return NextResponse.json({ error: "You do not have permission to update kitchen orders." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  const to = body?.status;
  if (!id || !to || !ORDER_STATUSES.includes(to as OrderStatus) || !["ACCEPTED", "PREPARING", "READY"].includes(to)) {
    return NextResponse.json({ error: "Invalid kitchen status update." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!canTransition(order.status, to as OrderStatus)) {
    return NextResponse.json({ error: `Cannot move an order from ${order.status} to ${to}.` }, { status: 409 });
  }

  const updated = await prisma.order.updateMany({
    where: { id, version: order.version },
    data: { status: to as OrderStatus, version: { increment: 1 } },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "This order was updated by another team member. Refresh and try again." }, { status: 409 });
  }

  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      fromStatus: order.status,
      toStatus: to as OrderStatus,
      actorId: staff.user.id,
      note: `Kitchen update by ${staff.user.fullName}`,
    },
  });

  if (to === "ACCEPTED") await deductForOrder(prisma, id);

  return NextResponse.json({ success: true, status: to });
}
