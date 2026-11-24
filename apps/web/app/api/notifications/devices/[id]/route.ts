import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const result = await prisma.pushDeviceToken.updateMany({
    where: { id, userId: user.id, disabledAt: null },
    data: { disabledAt: new Date() },
  });
  return NextResponse.json({ success: true, disabled: result.count });
}
