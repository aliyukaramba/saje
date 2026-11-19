import type { PrismaClient } from "@prisma/client";
import { planDeductions } from "@restaurant/shared";

/**
 * Deducts recipe ingredients for every line of an order. Called when the kitchen accepts the order.
 * Safe to run twice: each deduction has a unique key, so repeats are skipped. Stock may go negative,
 * which shows as a shortage on the inventory screen.
 */
export async function deductForOrder(db: PrismaClient, orderId: string): Promise<number> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return 0;

  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const recipes = await db.recipe.findMany({
    where: { productId: { in: productIds } },
    include: { ingredients: true },
  });
  const ingredientsByProduct = new Map(
    recipes.map((r) => [
      r.productId,
      r.ingredients.map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: Number(i.quantity.toString()) })),
    ]),
  );

  const plans = order.items.flatMap((item) =>
    planDeductions(order.id, item.id, item.quantity, ingredientsByProduct.get(item.productId) ?? []),
  );
  if (plans.length === 0) return 0;

  let deducted = 0;
  await db.$transaction(async (tx) => {
    for (const plan of plans) {
      const already = await tx.stockMovement.findUnique({ where: { idempotencyKey: plan.idempotencyKey } });
      if (already) continue;
      await tx.stockMovement.create({
        data: {
          inventoryItemId: plan.inventoryItemId,
          type: "DEDUCTION",
          quantity: -plan.quantity,
          referenceType: "order",
          referenceId: order.id,
          idempotencyKey: plan.idempotencyKey,
          note: order.orderNumber,
        },
      });
      await tx.inventoryItem.update({
        where: { id: plan.inventoryItemId },
        data: { quantityOnHand: { decrement: plan.quantity } },
      });
      deducted += 1;
    }
  });
  return deducted;
}
