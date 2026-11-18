import type { PrismaClient } from "@prisma/client";
import { priceCart, hashQrToken, canAddOrder, type CartLineInput } from "@restaurant/shared";
import { loadCatalog, minorToDecimal, OrderInputError } from "./orders";

/** Returns the active table for a raw QR token, or null if the link is unknown, revoked or the table is inactive. */
export async function findTableByToken(db: PrismaClient, rawToken: string) {
  const row = await db.qrToken.findUnique({
    where: { tokenHash: hashQrToken(rawToken) },
    include: { table: true },
  });
  if (!row || row.status !== "ACTIVE" || !row.table.isActive) return null;
  return row.table;
}

/**
 * Places a dine-in order from a table link. Prices are computed on the server. The order goes
 * straight to the kitchen (CONFIRMED); the bill is settled by staff when the table closes.
 */
export async function createTableOrder(db: PrismaClient, input: { rawToken: string; lines: CartLineInput[]; now: Date }) {
  const table = await findTableByToken(db, input.rawToken);
  if (!table) throw new OrderInputError("This table link is no longer valid. Please ask a member of staff.");

  const settings = await db.restaurantSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new OrderInputError("Restaurant settings are not configured");

  const catalog = await loadCatalog(db, [...new Set(input.lines.map((l) => l.productId))]);
  for (const line of input.lines) {
    const product = catalog.get(line.productId);
    if (!product) throw new OrderInputError("An item on your order is no longer available");
    if (product.variants.length > 0 || product.modifierGroups.length > 0) {
      throw new OrderInputError("Items with options cannot be ordered from the table yet");
    }
  }

  const taxRateBps = settings.taxRate ? Math.round(Number(settings.taxRate.toString()) * 10000) : 0;
  let priced;
  try {
    priced = priceCart(input.lines, catalog, { taxRateBps });
  } catch (e) {
    throw new OrderInputError(e instanceof Error ? e.message : "Invalid order");
  }

  const orderNumber = `SJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const { totals } = priced;

  await db.$transaction(async (tx) => {
    let session = await tx.tableSession.findFirst({
      where: { tableId: table.id, status: { not: "CLOSED" } },
    });
    if (!session) {
      // The partial unique index allows only one open session per table, so a race fails cleanly.
      session = await tx.tableSession.create({ data: { tableId: table.id } });
    }
    if (!canAddOrder(session.status)) {
      throw new OrderInputError("The bill for this table has been requested. Please ask a member of staff.");
    }

    await tx.order.create({
      data: {
        orderNumber,
        channel: "QR_TABLE",
        type: "DINE_IN",
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        currency: "NGN",
        subtotal: minorToDecimal(totals.subtotal),
        discountTotal: minorToDecimal(totals.discount),
        taxTotal: minorToDecimal(totals.tax),
        deliveryFee: "0",
        total: minorToDecimal(totals.total),
        placedAt: input.now,
        tableSessionId: session.id,
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
        statusHistory: { create: { fromStatus: null, toStatus: "CONFIRMED", note: `Table ${table.number} order` } },
      },
    });
  });

  return { orderNumber, tableNumber: table.number };
}
