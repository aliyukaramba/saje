// Menu data source. The only implementation is database-backed (Prisma via Hyperdrive),
// which is not wired yet, so this returns an empty catalog. Nothing is hardcoded here.
export interface MenuItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: string;            // formatted by the server
  discountPrice: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
}

export interface MenuCategoryView {
  id: string;
  name: string;
}

export interface MenuData {
  categories: MenuCategoryView[];
  items: MenuItemView[];
  source: "database" | "unavailable";
}

export async function loadMenu(): Promise<MenuData> {
  return { categories: [], items: [], source: "unavailable" };
}
