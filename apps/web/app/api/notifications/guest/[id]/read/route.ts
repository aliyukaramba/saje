import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const reference = new URL(request.url).searchParams.get("ref") ?? "";
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(reference)) return NextResponse.json({ error: "Invalid order reference." }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (!payment) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { id } = await context.params;
  const result = await prisma.notification.updateMany({
    where: { id, guestReference: reference, userId: null, channel: "IN_APP" },
    data: { readAt: new Date() },
  });
  if (!result.count) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
