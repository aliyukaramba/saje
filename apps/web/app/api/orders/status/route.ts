import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

// Returns only the public status of an order, looked up by its unguessable payment reference.
export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("ref") ?? "";
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(reference)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: { status: true, order: { select: { orderNumber: true, status: true, paymentStatus: true } } },
  });
  if (!payment) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    paymentStatus: payment.status,
    orderNumber: payment.order.orderNumber,
    orderStatus: payment.order.status,
  });
}
