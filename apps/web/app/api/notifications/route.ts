import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 50);
  const cursor = url.searchParams.get("cursor");
  const rows = await prisma.notification.findMany({
    where: { userId: user.id, channel: "IN_APP", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: { id: true, type: true, category: true, title: true, body: true, payload: true, priority: true, readAt: true, createdAt: true, relatedEntityType: true, relatedEntityId: true },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ notifications: items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null });
}
