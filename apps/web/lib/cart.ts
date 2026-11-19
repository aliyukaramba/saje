// Per-browser cart. Only product ids, variant and modifier ids, and quantities are trusted by the server;
// prices are shown for reference and recalculated on checkout. Every storage access is wrapped so a blocked
// storage does not break the page.
export interface CartLine {
  /** Unique per product + variant + modifier selection, so the same dish with different options is a separate line. */
  lineKey: string;
  productId: string;
  name: string;
  unitLabel: string;
  optionLabel: string;
  variantId?: string;
  modifierIds: string[];
  quantity: number;
}

const KEY = "saje-cart";
export const CART_EVENT = "saje-cart-change";

export function lineKeyOf(productId: string, variantId: string | undefined, modifierIds: string[]): string {
  return [productId, variantId ?? "", [...modifierIds].sort().join(",")].join("|");
}

export function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<CartLine>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.productId === "string" && typeof l.quantity === "number" && l.quantity > 0 && l.quantity <= 99)
      .map((l) => {
        const modifierIds = Array.isArray(l.modifierIds) ? l.modifierIds.filter((x) => typeof x === "string") : [];
        const variantId = typeof l.variantId === "string" ? l.variantId : undefined;
        return {
          lineKey: lineKeyOf(l.productId as string, variantId, modifierIds),
          productId: l.productId as string,
          name: String(l.name ?? ""),
          unitLabel: String(l.unitLabel ?? ""),
          optionLabel: String(l.optionLabel ?? ""),
          variantId,
          modifierIds,
          quantity: l.quantity as number,
        };
      });
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable: cart works for this page view only */
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(item: {
  id: string; name: string; price: string; variantId?: string; modifierIds?: string[]; optionLabel?: string;
}): void {
  const modifierIds = [...(item.modifierIds ?? [])].sort();
  const lineKey = lineKeyOf(item.id, item.variantId, modifierIds);
  const lines = readCart();
  const existing = lines.find((l) => l.lineKey === lineKey);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + 1);
  } else {
    lines.push({
      lineKey,
      productId: item.id,
      name: item.name,
      unitLabel: item.price,
      optionLabel: item.optionLabel ?? "",
      variantId: item.variantId,
      modifierIds,
      quantity: 1,
    });
  }
  writeCart(lines);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function clearCart(): void {
  writeCart([]);
}
