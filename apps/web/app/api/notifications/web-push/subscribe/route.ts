import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = body?.endpoint?.trim() ?? "";
  const p256dh = body?.keys?.p256dh ?? "";
  const auth = body?.keys?.auth ?? "";
  if (!endpoint.startsWith("https://") || endpoint.length > 2048 || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid browser push subscription." }, { status: 400 });
  }
  const subscription = await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent: request.headers.get("user-agent")?.slice(0, 300) },
    update: { userId: user.id, p256dh, auth, userAgent: request.headers.get("user-agent")?.slice(0, 300), disabledAt: null },
    select: { id: true },
  });
  return NextResponse.json({ success: true, subscriptionId: subscription.id });
}

export async function DELETE(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Subscription endpoint required." }, { status: 400 });
  const result = await prisma.webPushSubscription.updateMany({
    where: { userId: user.id, endpoint: body.endpoint, disabledAt: null },
    data: { disabledAt: new Date() },
  });
  return NextResponse.json({ success: true, disabled: result.count });
}
