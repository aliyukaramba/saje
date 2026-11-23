import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, createPickupOrder, createDeliveryOrder, OrderInputError } from "@restaurant/database";
import { TopifyClient } from "@restaurant/shared";

export const dynamic = "force-dynamic";

const pickupSchema = z.object({
  type: z.literal("PICKUP"),
  pickupAt: z.string().datetime(),
});

const deliverySchema = z.object({
  type: z.literal("DELIVERY"),
  zoneId: z.string().min(1).max(64),
  address: z.object({
    line1: z.string().trim().min(3).max(160),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    landmark: z.string().trim().max(160).optional(),
    instructions: z.string().trim().max(300).optional(),
  }),
});

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
  fulfilment: z.discriminatedUnion("type", [pickupSchema, deliverySchema]),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your details and try again." }, { status: 422 });
  }
  const { lines, customer, fulfilment } = parsed.data;
  try {
    const now = new Date();
    const order = fulfilment.type === "PICKUP"
      ? await createPickupOrder(prisma, { lines, customer, pickupAt: new Date(fulfilment.pickupAt), now })
      : await createDeliveryOrder(prisma, { lines, customer, zoneId: fulfilment.zoneId, address: fulfilment.address, now });

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
    return NextResponse.json({ checkoutUrl: checkout.checkout_url, orderNumber: order.orderNumber, reference: order.reference });
  } catch (e) {
    if (e instanceof OrderInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("checkout failed", e);
    return NextResponse.json({ error: "We could not start your payment. Please try again." }, { status: 500 });
  }
}
