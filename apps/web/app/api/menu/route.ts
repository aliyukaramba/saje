import { NextResponse } from "next/server";
import { loadMenu } from "../../../lib/catalog-source";

export const dynamic = "force-dynamic";

/** Public menu for the mobile app. Read-only; contains no customer or staff data. */
export async function GET() {
  const menu = await loadMenu();
  return NextResponse.json(menu, { headers: { "cache-control": "no-store" } });
}
