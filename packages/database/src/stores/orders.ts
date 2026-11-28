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

/** Builds the modifier snapshot rows for an order item, so the receipt keeps names and prices as sold. */
export function modifierSnapshots(catalog: Map<string, CatalogProduct>, modifierIds: string[]) {
  const info = new Map<string, { name: string; priceDelta: Minor }>();
  for (const p of catalog.values()) {
    for (const g of p.modifierGroups) for (const m of g.modifiers) info.set(m.id, { name: m.name, priceDelta: m.priceDelta });
  }
  return modifierIds.map((id) => {
    const i = info.get(id);
    return { modifierId: id, nameSnapshot: i?.name ?? "Option", priceSnapshot: minorToDecimal(i?.priceDelta ?? 0n) };
  });
}

/**
 * Writes order lines and their modifiers in two batched statements. A nested create sends one statement
 * per row, each a database round trip, so a multi-item order paid that cost for every item and modifier.
 * IDs are generated here so modifiers can point at their lines without reading them back.
 */
export async function writeOrderLines(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: PricedCart["lines"],
  catalog: Map<string, CatalogProduct>,
) {
  const itemRows = lines.map((l) => ({
    id: crypto.randomUUID(),
    orderId,
    productId: l.productId,
    variantId: l.variantId ?? null,
    nameSnapshot: catalog.get(l.productId)?.name ?? "Item",
    unitPrice: minorToDecimal(l.unitPrice),
    quantity: l.quantity,
    lineTotal: minorToDecimal(l.lineTotal),
  }));
  if (itemRows.length > 0) await tx.orderItem.createMany({ data: itemRows });

  const modifierRows = lines.flatMap((l, i) =>
    modifierSnapshots(catalog, l.modifierIds).map((m) => ({ ...m, orderItemId: itemRows[i].id })),
  );
  if (modifierRows.length > 0) await tx.orderItemModifier.createMany({ data: modifierRows });
}

export interface PickupOrderInput {
  lines: CartLineInput[];
  customer: { name: string; phone: string; email: string };
  pickupAt: Date;
  now: Date;
}

export async function loadCatalog(db: PrismaClient, productIds: string[]): Promise<Map<string, CatalogProduct>> {
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
        statusHistory: { create: { fromStatus: null, toStatus: "PENDING", note: "Order placed" } },
      },
    });
    await writeOrderLines(tx, order.id, priced.lines, catalog);
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
