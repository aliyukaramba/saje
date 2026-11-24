import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const installationId = typeof body?.installationId === "string" ? body.installationId.trim() : "";
  const platform = body?.platform;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(reference) || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) ||
      installationId.length < 8 || installationId.length > 128 || !["IOS", "ANDROID"].includes(String(platform))) {
    return NextResponse.json({ error: "Invalid guest device registration." }, { status: 400 });
  }
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { orderId: true } });
  if (!payment) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const device = await prisma.guestPushDeviceToken.upsert({
    where: { orderId_installationId: { orderId: payment.orderId, installationId } },
    create: {
      orderId: payment.orderId, installationId, token,
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
