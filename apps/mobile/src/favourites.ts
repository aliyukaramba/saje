import AsyncStorage from "@react-native-async-storage/async-storage";

// Favourite dishes are kept on this phone only.
const KEY = "saje-mobile-favourites";

async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function isFavourite(id: string): Promise<boolean> {
  return (await read()).includes(id);
}

/** Flips the favourite state for a dish and returns the new state. */
export async function toggleFavourite(id: string): Promise<boolean> {
  const list = await read();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the change lasts for this visit only */
  }
  return next.includes(id);
}
