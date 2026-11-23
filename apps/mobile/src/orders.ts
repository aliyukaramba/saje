import AsyncStorage from "@react-native-async-storage/async-storage";

// Orders placed from this phone, so the guest can check their status later. Stored on the phone only.
export interface SavedOrder { orderNumber: string; reference: string; placedAt: string }

const KEY = "saje-mobile-orders";

export async function readOrders(): Promise<SavedOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedOrder[]) : [];
  } catch {
    return [];
  }
}

export async function rememberOrder(order: SavedOrder) {
  try {
    const list = (await readOrders()).filter((o) => o.reference !== order.reference);
    list.unshift(order);
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* storage unavailable: the order still exists on the server */
  }
}

export async function removeSavedOrder(reference: string): Promise<SavedOrder[]> {
  const list = (await readOrders()).filter((order) => order.reference !== reference);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: keep the in-memory screen usable for this session */
  }
  return list;
}
