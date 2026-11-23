import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The cart lives on the phone. The server recalculates every price at checkout.
export interface CartLine {
  lineKey: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  variantId: string | null;
  modifierIds: string[];
  optionLabel: string;
  /** Unit price in kobo, including the chosen size and add-ons. */
  unitMinor: number;
  quantity: number;
}

export type NewLine = Omit<CartLine, "lineKey" | "quantity">;

export function lineKeyOf(productId: string, variantId: string | null, modifierIds: string[]): string {
  return [productId, variantId ?? "", [...modifierIds].sort().join(",")].join("|");
}

const KEY = "saje-mobile-cart-v2";
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable: the cart still works for this session */
  }
}

export async function loadCart() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) lines = parsed as CartLine[];
    emit();
  } catch {
    /* ignore a damaged cart */
  }
}

export function addLine(line: NewLine) {
  const lineKey = lineKeyOf(line.productId, line.variantId, line.modifierIds);
  const existing = lines.find((l) => l.lineKey === lineKey);
  lines = existing
    ? lines.map((l) => (l.lineKey === lineKey ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l))
    : [...lines, { ...line, lineKey, quantity: 1 }];
  emit();
  void persist();
}

export function changeQuantity(lineKey: string, delta: number) {
  lines = lines
    .map((l) => (l.lineKey === lineKey ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
  emit();
  void persist();
}

export function removeLine(lineKey: string) {
  lines = lines.filter((l) => l.lineKey !== lineKey);
  emit();
  void persist();
}

export function clearCart() {
  lines = [];
  emit();
  void persist();
}

export function subtotalKobo(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.unitMinor * l.quantity, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, () => lines, () => lines);
}
