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
type CartUpdate = (current: CartLine[]) => CartLine[];

export function lineKeyOf(productId: string, variantId: string | null, modifierIds: string[]): string {
  return [productId, variantId ?? "", [...modifierIds].sort().join(",")].join("|");
}

const KEY = "saje-mobile-cart-v2";
const MAX_QUANTITY = 99;
let lines: CartLine[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let pendingUpdates: CartUpdate[] = [];
let persistQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  // Serialize writes so a slow earlier write cannot overwrite a newer cart.
  const snapshot = JSON.stringify(lines);
  persistQueue = persistQueue.then(() => AsyncStorage.setItem(KEY, snapshot)).catch(() => {
    /* storage unavailable: the cart still works for this session */
  });
}

function updateCart(update: CartUpdate) {
  lines = update(lines);
  if (!loaded) pendingUpdates.push(update);
  emit();
  if (loaded) persist();
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return typeof line.lineKey === "string"
    && typeof line.productId === "string"
    && typeof line.name === "string"
    && (typeof line.imageUrl === "string" || line.imageUrl === null)
    && (typeof line.variantId === "string" || line.variantId === null)
    && Array.isArray(line.modifierIds)
    && line.modifierIds.every((id) => typeof id === "string")
    && typeof line.optionLabel === "string"
    && typeof line.unitMinor === "number"
    && Number.isFinite(line.unitMinor)
    && typeof line.quantity === "number"
    && Number.isInteger(line.quantity)
    && line.quantity >= 1
    && line.quantity <= MAX_QUANTITY;
}

export function loadCart(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let restored: CartLine[] = [];
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) restored = parsed.filter(isCartLine);
    } catch {
      /* ignore a damaged or unavailable saved cart */
    }

    // Replay user actions made while AsyncStorage was being read. In particular,
    // clearCart must not be undone by a late restore.
    lines = restored;
    for (const update of pendingUpdates) lines = update(lines);
    const hadPendingUpdates = pendingUpdates.length > 0;
    pendingUpdates = [];
    loaded = true;
    emit();
    if (hadPendingUpdates) persist();
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export function addLine(line: NewLine) {
  const lineKey = lineKeyOf(line.productId, line.variantId, line.modifierIds);
  updateCart((current) => {
    const existing = current.find((item) => item.lineKey === lineKey);
    return existing
      ? current.map((item) => item.lineKey === lineKey
        ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + 1) }
        : item)
      : [...current, { ...line, lineKey, quantity: 1 }];
  });
}

export function changeQuantity(lineKey: string, delta: number) {
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) return;
  updateCart((current) => current
    .map((line) => line.lineKey === lineKey
      ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + delta) }
      : line)
    .filter((line) => line.quantity > 0));
}

export function removeLine(lineKey: string) {
  updateCart((current) => current.filter((line) => line.lineKey !== lineKey));
}

export function clearCart() {
  updateCart(() => []);
}

export function subtotalKobo(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitMinor * line.quantity, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, () => lines, () => lines);
}
