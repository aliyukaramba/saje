import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The cart lives on the phone. Prices are shown from the menu; the server recalculates them at checkout.
export interface CartLine { productId: string; name: string; price: string; quantity: number }

const KEY = "saje-mobile-cart";
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

export function addToCart(item: { id: string; name: string; price: string }) {
  const existing = lines.find((l) => l.productId === item.id);
  lines = existing
    ? lines.map((l) => (l.productId === item.id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l))
    : [...lines, { productId: item.id, name: item.name, price: item.price, quantity: 1 }];
  emit();
  void persist();
}

export function changeQuantity(productId: string, delta: number) {
  lines = lines
    .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
  emit();
  void persist();
}

export function clearCart() {
  lines = [];
  emit();
  void persist();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, () => lines, () => lines);
}
