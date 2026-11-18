import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, createPickupOrder, OrderInputError } from "@restaurant/database";
import { TopifyClient } from "@restaurant/shared";

export const dynamic = "force-dynamic";

const schema = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(99),
    variantId: z.string().max(64).optional(),
    modifierIds: z.array(z.string().max(64)).max(20).default([]),
  })).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email().max(254),
  }),
  pickupAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your details and try again." }, { status: 422 });
  }
  const { lines, customer, pickupAt } = parsed.data;
  try {
    const order = await createPickupOrder(prisma, {
      lines, customer, pickupAt: new Date(pickupAt), now: new Date(),
    });
    const topify = new TopifyClient({
      publicKey: process.env.TOPIFY_PUBLIC_KEY,
      secretKey: process.env.TOPIFY_SECRET_KEY,
    });
    const origin = new URL(req.url).origin;
    const checkout = await topify.initializeCheckout({
      amountKobo: order.amountKobo,
      email: customer.email,
      reference: order.reference,
      customerName: customer.name,
      callbackUrl: `${origin}/checkout/return?ref=${encodeURIComponent(order.reference)}`,
      metadata: { orderNumber: order.orderNumber },
    });
    return NextResponse.json({ checkoutUrl: checkout.checkout_url, orderNumber: order.orderNumber });
  } catch (e) {
    if (e instanceof OrderInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("checkout failed", e);
    return NextResponse.json({ error: "We could not start your payment. Please try again." }, { status: 500 });
  }
}
