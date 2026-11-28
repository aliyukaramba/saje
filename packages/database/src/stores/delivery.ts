import type { PrismaClient } from "@prisma/client";
import { priceCart, validateFulfilment, parseMajorToMinor, type CartLineInput } from "@restaurant/shared";
import { loadCatalog, minorToDecimal, OrderInputError, modifierSnapshots } from "./orders";
import { getCachedSettings } from "./settings-cache";

export interface DeliveryAddressInput {
  line1: string;
  city: string;
  state: string;
  landmark?: string;
  instructions?: string;
}

/** Zones and switches the website needs to offer pickup and delivery. */
export async function loadFulfilmentOptions(db: PrismaClient) {
  const [settings, zones] = await Promise.all([
    getCachedSettings(db),
    db.deliveryZone.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    pickupEnabled: settings?.pickupEnabled ?? true,
    deliveryEnabled: settings?.deliveryEnabled ?? false,
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      fee: z.fee.toString(),
      minOrderAmount: z.minOrderAmount.toString(),
    })),
  };
}

/**
 * Delivery order from the website. Fee and minimum come from the chosen zone, and the total is
 * computed on the server. The address is stored as text on the order (guests have no address book).
 */
export async function createDeliveryOrder(
  db: PrismaClient,
  input: {
    lines: CartLineInput[];
    customer: { name: string; phone: string; email: string };
    zoneId: string;
    address: DeliveryAddressInput;
    now: Date;
  },
) {
  const settings = await getCachedSettings(db);
  if (!settings) throw new OrderInputError("Restaurant settings are not configured");
  if (!settings.deliveryEnabled) throw new OrderInputError("Delivery is not available right now");

  const zone = await db.deliveryZone.findUnique({ where: { id: input.zoneId } });
  if (!zone || !zone.isActive) throw new OrderInputError("We do not deliver to this area");

  const catalog = await loadCatalog(db, [...new Set(input.lines.map((l) => l.productId))]);
  for (const line of input.lines) {
    const product = catalog.get(line.productId);
    if (!product) throw new OrderInputError("An item on your order is no longer available");
  }

  const taxRateBps = settings.taxRate ? Math.round(Number(settings.taxRate.toString()) * 10000) : 0;
  let subtotalPriced;
  try {
    subtotalPriced = priceCart(input.lines, catalog, { taxRateBps: 0 });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid order");
  }

  let fulfilment;
  try {
    fulfilment = validateFulfilment({
      type: "DELIVERY",
      subtotal: subtotalPriced.totals.subtotal,
      deliveryEnabled: settings.deliveryEnabled,
      pickupEnabled: settings.pickupEnabled,
      zone: {
        id: zone.id,
        fee: parseMajorToMinor(zone.fee.toString()),
        minOrderAmount: parseMajorToMinor(zone.minOrderAmount.toString()),
        isActive: zone.isActive,
      },
      now: input.now,
      pickupLeadMinutes: 20,
    });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid delivery");
  }

  const priced = priceCart(input.lines, catalog, { taxRateBps, deliveryFee: fulfilment.deliveryFee });
  const { totals } = priced;
  const orderNumber = `SJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const addressText = [
    `Deliver to: ${input.address.line1}, ${input.address.city}, ${input.address.state}`,
    input.address.landmark ? `Landmark: ${input.address.landmark}` : null,
    input.address.instructions ? `Instructions: ${input.address.instructions}` : null,
  ].filter(Boolean).join(". ");

  await db.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        orderNumber,
        channel: "WEBSITE",
        type: "DELIVERY",
        status: "PENDING",
        paymentStatus: "UNPAID",
        guestName: input.customer.name,
        guestPhone: input.customer.phone,
        guestEmail: input.customer.email,
        deliveryZoneId: zone.id,
        specialInstructions: addressText,
        currency: "NGN",
        subtotal: minorToDecimal(totals.subtotal),
        discountTotal: minorToDecimal(totals.discount),
        taxTotal: minorToDecimal(totals.tax),
        deliveryFee: minorToDecimal(totals.deliveryFee),
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
        statusHistory: { create: { fromStatus: null, toStatus: "PENDING", note: "Delivery order placed" } },
      },
    });
  });

  const order = await db.order.findUniqueOrThrow({ where: { orderNumber } });
  await db.payment.create({
    data: {
      orderId: order.id,
      method: "TOPIFY",
      status: "PENDING",
      amount: minorToDecimal(totals.total),
      currency: "NGN",
      reference: orderNumber,
      idempotencyKey: orderNumber,
    },
  });

  return { orderNumber, reference: orderNumber, amountKobo: totals.total };
}
