export interface RecipeLine {
  inventoryItemId: string;
  quantity: number; // integer base units per portion (g, ml or piece)
}

export interface StockDeduction {
  inventoryItemId: string;
  quantity: number;       // positive amount to remove from stock
  idempotencyKey: string;
}

/**
 * Plans deductions for one order line. The key includes the order line id, so reprocessing
 * the same order line produces the same keys and the store can ignore duplicates.
 */
export function planDeductions(
  orderId: string,
  orderItemId: string,
  quantitySold: number,
  recipe: readonly RecipeLine[],
): StockDeduction[] {
  if (!Number.isInteger(quantitySold) || quantitySold <= 0) throw new Error("Quantity must be a positive integer");
  return recipe.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Recipe quantities must be positive integers");
    return {
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity * quantitySold,
      idempotencyKey: `order:${orderId}:line:${orderItemId}:item:${line.inventoryItemId}`,
    };
  });
}

/** Applies deductions to stock levels, skipping keys already applied. Stock never goes below zero. */
export function applyDeductions(
  stock: Map<string, number>,
  deductions: readonly StockDeduction[],
  appliedKeys: Set<string>,
): { applied: StockDeduction[]; skipped: StockDeduction[]; shortfalls: { inventoryItemId: string; missing: number }[] } {
  const applied: StockDeduction[] = [];
  const skipped: StockDeduction[] = [];
  const shortfalls: { inventoryItemId: string; missing: number }[] = [];
  for (const d of deductions) {
    if (appliedKeys.has(d.idempotencyKey)) {
      skipped.push(d);
      continue;
    }
    const current = stock.get(d.inventoryItemId) ?? 0;
    const next = current - d.quantity;
    if (next < 0) shortfalls.push({ inventoryItemId: d.inventoryItemId, missing: -next });
    stock.set(d.inventoryItemId, Math.max(0, next));
    appliedKeys.add(d.idempotencyKey);
    applied.push(d);
  }
  return { applied, skipped, shortfalls };
}

export function isLowStock(quantityOnHand: number, reorderLevel: number): boolean {
  return quantityOnHand <= reorderLevel;
}
