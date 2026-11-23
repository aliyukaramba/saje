import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SavedReservation {
  id: string;
  guestName: string;
  partySize: number;
  startsAt: string;
  status: string;
}

const KEY = "saje-mobile-reservations";

export async function readReservations(): Promise<SavedReservation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedReservation[]) : [];
  } catch {
    return [];
  }
}

export async function rememberReservation(reservation: SavedReservation): Promise<SavedReservation[]> {
  const list = (await readReservations()).filter((item) => item.id !== reservation.id);
  list.unshift(reservation);
  const next = list.slice(0, 20);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The server reservation remains valid if local history cannot be saved.
  }
  return next;
}
