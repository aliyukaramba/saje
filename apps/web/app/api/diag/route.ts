// TEMPORARY diagnostic: shows which database the Worker reads, with counts only. Remove after debugging.
import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function GET() {
  let host = "not set";
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    host = `${u.host}${u.pathname}`;
  } catch {
    host = "not set or invalid";
  }
  try {
    const [staff, categories, products] = await Promise.all([
      prisma.user.count({ where: { kind: "STAFF" } }),
      prisma.category.count(),
      prisma.product.count(),
    ]);
    return NextResponse.json({ host, staff, categories, products });
  } catch (e) {
    return NextResponse.json({ host, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
