import { NextResponse } from "next/server";
import { prisma, loadFulfilmentOptions } from "@restaurant/database";

export const dynamic = "force-dynamic";

/** Whether pickup and delivery are open, and the delivery zones with their fees. Public and read-only. */
export async function GET() {
  const options = await loadFulfilmentOptions(prisma);
  return NextResponse.json(options, { headers: { "cache-control": "no-store" } });
}
