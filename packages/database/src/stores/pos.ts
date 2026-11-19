import type { PrismaClient } from "@prisma/client";
import { priceCart, type CartLineInput } from "@restaurant/shared";
import { loadCatalog, minorToDecimal, OrderInputError } from "./orders";

/**
 * Counter sale: priced on the server, paid in cash at the counter, and sent to the kitchen.
 * Card and transfer payments at the counter are not supported yet.
 */
export async function createPosOrder(
  db: PrismaClient,
  input: { lines: CartLineInput[]; customerName: string | null; staffEmail: string; now: Date },
) {
  const settings = await db.restaurantSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new OrderInputError("Restaurant settings are not configured");

  const catalog = await loadCatalog(db, [...new Set(input.lines.map((l) => l.productId))]);
  for (const line of input.lines) {
    const product = catalog.get(line.productId);
    if (!product) throw new OrderInputError("An item on this sale is no longer available");
    if (product.variants.length > 0 || product.modifierGroups.length > 0) {
      throw new OrderInputError("Items with options cannot be sold at the counter yet");
    }
  }

  const taxRateBps = settings.taxRate ? Math.round(Number(settings.taxRate.toString()) * 10000) : 0;
  let priced;
  try {
    priced = priceCart(input.lines, catalog, { taxRateBps });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid sale");
  }

  const orderNumber = `SJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const { totals } = priced;

  await db.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        type: "WALK_IN_POS",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        guestName: input.customerName,
        currency: "NGN",
        subtotal: minorToDecimal(totals.subtotal),
        discountTotal: minorToDecimal(totals.discount),
        taxTotal: minorToDecimal(totals.tax),
        deliveryFee: "0",
        total: minorToDecimal(totals.total),
        placedAt: input.now,
        items: {
          create: priced.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            nameSnapshot: catalog.get(l.productId)?.name ?? "Item",
            unitPrice: minorToDecimal(l.unitPrice),
            quantity: l.quantity,
            lineTotal: minorToDecimal(l.lineTotal),
          })),
        },
        statusHistory: { create: { fromStatus: null, toStatus: "CONFIRMED", note: `Counter sale by ${input.staffEmail}` } },
      },
    });
  });

  // Create the payment in a second step so the order id is known; both are checked by the same
  // reference, so a retry with the same order number is refused by the unique constraints.
  const order = await db.order.findUniqueOrThrow({ where: { orderNumber } });
  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      method: "CASH",
      status: "SUCCESSFUL",
      amount: minorToDecimal(totals.total),
      currency: "NGN",
      reference: `CASH-${orderNumber}`,
      idempotencyKey: `cash-${orderNumber}`,
    },
  });
  await db.paymentEvent.create({
    data: { paymentId: payment.id, fromStatus: null, toStatus: "SUCCESSFUL", source: `staff:${input.staffEmail}` },
  });

  return { orderNumber, total: totals.total };
}
