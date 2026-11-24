import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

function validReference(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("ref") ?? "";
  if (!validReference(reference)) return NextResponse.json({ error: "Invalid order reference." }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (!payment) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const notifications = await prisma.notification.findMany({
    where: { guestReference: reference, userId: null, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, type: true, priority: true, readAt: true, createdAt: true },
  });
  return NextResponse.json({ notifications });
}
