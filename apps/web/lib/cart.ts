// Per-browser cart. Only product ids and quantities are trusted by the server; prices are shown for
// reference and recalculated on checkout. Every storage access is wrapped so a blocked storage
// does not break the page.
export interface CartLine {
  productId: string;
  name: string;
  unitLabel: string;
  quantity: number;
}

const KEY = "saje-cart";
export const CART_EVENT = "saje-cart-change";

export function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.productId === "string" && l.quantity > 0 && l.quantity <= 99)
      : [];
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

export function addToCart(item: { id: string; name: string; price: string }): void {
  const lines = readCart();
  const existing = lines.find((l) => l.productId === item.id);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + 1);
  } else {
    lines.push({ productId: item.id, name: item.name, unitLabel: item.price, quantity: 1 });
  }
  writeCart(lines);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function clearCart(): void {
  writeCart([]);
}
