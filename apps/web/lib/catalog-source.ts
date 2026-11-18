// Menu data for the website, read from the database on the server.
// If the database is unreachable the page shows an error state; nothing is hardcoded.
import { prisma, loadMenuFromDb, type MenuData } from "@restaurant/database";

export type { MenuData, MenuItemView } from "@restaurant/database";

export async function loadMenu(): Promise<MenuData> {
  try {
    return await loadMenuFromDb(prisma);
  } catch {
    return { categories: [], items: [], source: "database" as const };
  }
}
