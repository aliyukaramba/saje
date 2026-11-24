import type { PrismaClient } from "@prisma/client";
import { priceCart, formatMinor, type CartLineInput, type Minor } from "@restaurant/shared";
import { loadCatalog, minorToDecimal, OrderInputError, modifierSnapshots } from "./orders";

export type CounterPaymentMethod = "CASH" | "POS_TERMINAL" | "BANK_TRANSFER";

/**
 * Counter sale: priced on the server, paid in cash at the counter, and sent to the kitchen.
 * Card and transfer payments at the counter are not supported yet.
 */
export async function createPosOrder(
  db: PrismaClient,
  input: { lines: CartLineInput[]; customerName: string | null; staffEmail: string; now: Date; cashTendered: Minor | null; method: CounterPaymentMethod },
) {
  const settings = await db.restaurantSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new OrderInputError("Restaurant settings are not configured");

  const catalog = await loadCatalog(db, [...new Set(input.lines.map((l) => l.productId))]);
  for (const line of input.lines) {
    const product = catalog.get(line.productId);
    if (!product) throw new OrderInputError("An item on this sale is no longer available");
  }

  const taxRateBps = settings.taxRate ? Math.round(Number(settings.taxRate.toString()) * 10000) : 0;
  let priced;
  try {
    priced = priceCart(input.lines, catalog, { taxRateBps });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid sale");
  }

  const { totals } = priced;
  // Change is only worked out for cash. Cash given must cover the priced total. Checked before anything is saved.
  const cash = input.method === "CASH" ? input.cashTendered : null;
  if (cash !== null && cash < totals.total) {
    throw new OrderInputError(`Cash received is less than the total of ${formatMinor(totals.total)}`);
  }
  const change: Minor | null = cash !== null ? cash - totals.total : null;

  const orderNumber = `SJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

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
            modifiers: { create: modifierSnapshots(catalog, l.modifierIds) },
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
      method: input.method,
      status: "SUCCESSFUL",
      amount: minorToDecimal(totals.total),
      currency: "NGN",
      reference: `${input.method}-${orderNumber}`,
      idempotencyKey: `${input.method.toLowerCase()}-${orderNumber}`,
      cashTendered: cash !== null ? minorToDecimal(cash) : null,
      changeGiven: change !== null ? minorToDecimal(change) : null,
    },
  });
  await db.paymentEvent.create({
    data: { paymentId: payment.id, fromStatus: null, toStatus: "SUCCESSFUL", source: `staff:${input.staffEmail}` },
  });

  return { orderNumber, total: totals.total, change };
}
