// Menu data for the website, read from the database on the server.
// If the database is unreachable the page shows an error state; nothing is hardcoded.
import { prisma, loadMenuFromDb, type MenuItemView } from "@restaurant/database";

export interface WebMenuData {
  categories: { id: string; name: string }[];
  items: MenuItemView[];
  source: "database" | "unavailable";
}

export async function loadMenu(): Promise<WebMenuData> {
  try {
    return await loadMenuFromDb(prisma);
  } catch {
    return { categories: [], items: [], source: "unavailable" };
  }
}
