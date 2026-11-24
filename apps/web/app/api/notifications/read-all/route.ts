import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ success: true, updated: result.count });
}
