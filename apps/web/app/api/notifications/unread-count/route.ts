import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const count = await prisma.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  return NextResponse.json({ count });
}
