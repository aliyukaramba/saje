import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notificationUser } from "../../../../lib/notifications/auth";

export const dynamic = "force-dynamic";
const categories = ["ORDERS", "PROMOTIONS", "ACCOUNT", "GENERAL"] as const;

export async function GET(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const preferences = await prisma.notificationPreference.findMany({ where: { userId: user.id } });
  return NextResponse.json({ preferences, categories });
}

export async function PATCH(request: Request) {
  const user = await notificationUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const category = String(body?.category ?? "");
  if (!categories.includes(category as typeof categories[number])) return NextResponse.json({ error: "Invalid notification category." }, { status: 400 });
  const data: { inApp?: boolean; push?: boolean; email?: boolean; sms?: boolean } = {};
  for (const key of ["inApp", "push", "email", "sms"] as const) {
    if (typeof body?.[key] === "boolean") data[key] = body[key] as boolean;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Provide at least one preference." }, { status: 400 });
  const preference = await prisma.notificationPreference.upsert({
    where: { userId_category: { userId: user.id, category } },
    create: { userId: user.id, category, ...data },
    update: data,
  });
  return NextResponse.json({ preference });
}
