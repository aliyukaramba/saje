import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, createTableOrder, OrderInputError } from "@restaurant/database";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(120),
  lines: z.array(z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your order and try again." }, { status: 422 });
  try {
    const result = await createTableOrder(prisma, {
      rawToken: parsed.data.token,
      lines: parsed.data.lines.map((l) => ({ ...l, modifierIds: [] })),
      now: new Date(),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("table order failed", e);
    return NextResponse.json({ error: "We could not send your order. Please try again or ask a member of staff." }, { status: 500 });
  }
}
