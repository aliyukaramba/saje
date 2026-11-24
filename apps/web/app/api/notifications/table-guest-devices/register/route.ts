import { NextResponse } from "next/server";
import { findTableByToken, prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const tableToken = typeof body?.tableToken === "string" ? body.tableToken.trim() : "";
  const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const installationId = typeof body?.installationId === "string" ? body.installationId.trim() : "";
  const platform = body?.platform;
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(tableToken) || !/^SJ-[A-Z0-9-]{6,48}$/.test(orderNumber) ||
      !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) || installationId.length < 8 || installationId.length > 128 ||
      !["IOS", "ANDROID"].includes(String(platform))) {
    return NextResponse.json({ error: "Invalid table device registration." }, { status: 400 });
  }

  const table = await findTableByToken(prisma, tableToken);
  if (!table) return NextResponse.json({ error: "This table link is no longer valid." }, { status: 404 });
  const order = await prisma.order.findFirst({
    where: { orderNumber, session: { is: { tableId: table.id, status: { not: "CLOSED" } } } },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found for this table." }, { status: 404 });

  const device = await prisma.guestPushDeviceToken.upsert({
    where: { orderId_installationId: { orderId: order.id, installationId } },
    create: {
      orderId: order.id, installationId, token,
      platform: platform as "IOS" | "ANDROID",
      appVersion: typeof body?.appVersion === "string" ? body.appVersion.slice(0, 40) : null,
      lastSeenAt: new Date(), disabledAt: null,
    },
    update: {
      token, platform: platform as "IOS" | "ANDROID",
      appVersion: typeof body?.appVersion === "string" ? body.appVersion.slice(0, 40) : null,
      lastSeenAt: new Date(), disabledAt: null,
    },
    select: { id: true },
  });
  return NextResponse.json({ success: true, deviceId: device.id });
}
