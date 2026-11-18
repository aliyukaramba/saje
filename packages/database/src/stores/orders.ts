import type { Prisma, PrismaClient } from "@prisma/client";
import {
  priceCart, validateFulfilment, parseMajorToMinor,
  type CartLineInput, type CatalogProduct, type Minor, type PricedCart,
} from "@restaurant/shared";

/** Minor units (kobo) to a decimal string for Prisma Decimal(12,2). */
export function minorToDecimal(m: Minor): string {
  const neg = m < 0n;
  const a = neg ? -m : m;
  return `${neg ? "-" : ""}${a / 100n}.${(a % 100n).toString().padStart(2, "0")}`;
}

export class OrderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderInputError";
  }
}

export interface PickupOrderInput {
  lines: CartLineInput[];
  customer: { name: string; phone: string; email: string };
  pickupAt: Date;
  now: Date;
}

async function loadCatalog(db: PrismaClient, productIds: string[]): Promise<Map<string, CatalogProduct>> {
  const rows = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    include: { variants: true, modifierGroups: { include: { modifiers: true } } },
  });
  const map = new Map<string, CatalogProduct>();
  for (const p of rows) {
    map.set(p.id, {
      id: p.id,
      name: p.name,
      basePrice: parseMajorToMinor(p.basePrice.toString()),
      discountPrice: p.discountPrice ? parseMajorToMinor(p.discountPrice.toString()) : null,
      isAvailable: p.isAvailable,
      variants: p.variants.map((v) => ({
        id: v.id, name: v.name, priceDelta: parseMajorToMinor(v.priceDelta.toString()), isAvailable: v.isAvailable,
      })),
      modifierGroups: p.modifierGroups.map((g) => ({
        id: g.id, name: g.name, isRequired: g.isRequired, minSelect: g.minSelect, maxSelect: g.maxSelect,
        modifiers: g.modifiers.map((m) => ({
          id: m.id, name: m.name, priceDelta: parseMajorToMinor(m.priceDelta.toString()), isAvailable: m.isAvailable,
        })),
      })),
    });
  }
  return map;
}

/** Creates a pickup order with server-side pricing in one transaction. Payment is recorded as PENDING. */
export async function createPickupOrder(db: PrismaClient, input: PickupOrderInput) {
  const settings = await db.restaurantSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new OrderInputError("Restaurant settings are not configured");

  const catalog = await loadCatalog(db, [...new Set(input.lines.map((l) => l.productId))]);
  const taxRateBps = settings.taxRate ? Math.round(Number(settings.taxRate.toString()) * 10000) : 0;

  let priced: PricedCart;
  try {
    priced = priceCart(input.lines, catalog, { taxRateBps });
    validateFulfilment({
      type: "PICKUP",
      subtotal: priced.totals.subtotal,
      deliveryEnabled: settings.deliveryEnabled,
      pickupEnabled: settings.pickupEnabled,
      zone: null,
      pickupAt: input.pickupAt,
      now: input.now,
      pickupLeadMinutes: 20,
    });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid order");
  }

  const modifierInfo = new Map<string, { name: string; priceDelta: Minor }>();
  for (const p of catalog.values()) {
    for (const g of p.modifierGroups) for (const m of g.modifiers) modifierInfo.set(m.id, { name: m.name, priceDelta: m.priceDelta });
  }

  const orderNumber = `SJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const { totals } = priced;

  await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        channel: "WEBSITE",
        type: "PICKUP",
        status: "PENDING",
        paymentStatus: "UNPAID",
        guestName: input.customer.name,
        guestPhone: input.customer.phone,
        guestEmail: input.customer.email,
        currency: "NGN",
        subtotal: minorToDecimal(totals.subtotal),
        discountTotal: minorToDecimal(totals.discount),
        taxTotal: minorToDecimal(totals.tax),
        deliveryFee: "0",
        total: minorToDecimal(totals.total),
        scheduledFor: input.pickupAt,
        placedAt: input.now,
        items: {
          create: priced.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            nameSnapshot: catalog.get(l.productId)?.name ?? "Item",
            unitPrice: minorToDecimal(l.unitPrice),
            quantity: l.quantity,
            lineTotal: minorToDecimal(l.lineTotal),
            modifiers: {
              create: l.modifierIds.map((id) => {
                const info = modifierInfo.get(id);
                return {
                  modifierId: id,
                  nameSnapshot: info?.name ?? "Option",
                  priceSnapshot: minorToDecimal(info?.priceDelta ?? 0n),
                };
              }),
            },
          })),
        },
        statusHistory: { create: { fromStatus: null, toStatus: "PENDING", note: "Order placed" } },
      },
    });
    await tx.payment.create({
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
  });

  return { orderNumber, reference: orderNumber, amountKobo: totals.total };
}

export type { Prisma };
