import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, findTableOrderStatuses } from "@restaurant/database";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(120),
  orders: z.array(z.string().min(3).max(64)).max(20),
});

/** Status of the orders a guest placed from a table link during the table's current visit. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const orders = await findTableOrderStatuses(prisma, {
    rawToken: parsed.data.token,
    orderNumbers: parsed.data.orders,
  });
  if (orders === null) return NextResponse.json({ error: "This table link is no longer valid." }, { status: 404 });
  return NextResponse.json({ orders });
}
