import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const installationId = typeof body?.installationId === "string" ? body.installationId.trim() : "";
  const platform = body?.platform;
  const app = body?.app;
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) || installationId.length < 8 || installationId.length > 128 ||
      !["IOS", "ANDROID"].includes(String(platform)) || !["CUSTOMER", "STAFF"].includes(String(app))) {
    return NextResponse.json({ error: "Invalid push device registration." }, { status: 400 });
  }
  if (app === "STAFF" && user.kind !== "STAFF") return NextResponse.json({ error: "Staff account required." }, { status: 403 });
  if (app === "CUSTOMER" && user.kind !== "CUSTOMER") return NextResponse.json({ error: "Customer account required." }, { status: 403 });

  await prisma.pushDeviceToken.updateMany({
    where: { userId: user.id, installationId, app: app as "CUSTOMER" | "STAFF", disabledAt: null },
    data: { disabledAt: new Date() },
  });
  const device = await prisma.pushDeviceToken.upsert({
    where: { token },
    create: {
      userId: user.id, installationId, token, platform: platform as "IOS" | "ANDROID",
      app: app as "CUSTOMER" | "STAFF",
      deviceName: typeof body?.deviceName === "string" ? body.deviceName.slice(0, 120) : null,
      appVersion: typeof body?.appVersion === "string" ? body.appVersion.slice(0, 40) : null,
      lastSeenAt: new Date(), disabledAt: null,
    },
    update: {
      userId: user.id, installationId, platform: platform as "IOS" | "ANDROID",
      app: app as "CUSTOMER" | "STAFF",
      deviceName: typeof body?.deviceName === "string" ? body.deviceName.slice(0, 120) : null,
      appVersion: typeof body?.appVersion === "string" ? body.appVersion.slice(0, 40) : null,
      lastSeenAt: new Date(), disabledAt: null,
    },
    select: { id: true },
  });
  return NextResponse.json({ success: true, deviceId: device.id });
}
