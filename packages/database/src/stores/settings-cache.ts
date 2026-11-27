import type { PrismaClient } from "@prisma/client";

// Restaurant settings change rarely but are read on every order. Caching them for a short time saves
// one database round trip per order. Plain data is safe to share across requests (unlike connections).
// The cost: an admin change can take up to CACHE_TTL_MS to reach ordering. Admin pages read fresh data.
const CACHE_TTL_MS = 60_000;

async function loadSettingsRow(db: PrismaClient) {
  return db.restaurantSettings.findUnique({ where: { id: "singleton" } });
}
type SettingsRow = Awaited<ReturnType<typeof loadSettingsRow>>;

let cached: { value: NonNullable<SettingsRow>; loadedAt: number } | null = null;

/** Restaurant settings for ordering. Served from a 60-second cache; use the database directly for admin screens. */
export async function getCachedSettings(db: PrismaClient): Promise<SettingsRow> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.value;
  const value = await loadSettingsRow(db);
  if (value) cached = { value, loadedAt: Date.now() };
  return value;
}
