import type { PrismaClient } from "@prisma/client";
import { formatMinor, parseMajorToMinor } from "@restaurant/shared";

export interface MenuItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: string;
  discountPrice: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  /** True when the product has variants or modifiers; these need the options screen (not built yet). */
  hasOptions: boolean;
}

export interface MenuData {
  categories: { id: string; name: string }[];
  items: MenuItemView[];
  source: "database";
}

/** Active, non-deleted categories and products from the database. Prices are formatted here, on the server. */
export async function loadMenuFromDb(db: PrismaClient): Promise<MenuData> {
  const categories = await db.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const products = await db.product.findMany({
    where: { deletedAt: null, category: { isActive: true, deletedAt: null } },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { category: { select: { name: true } }, variants: { select: { id: true } }, modifierGroups: { select: { id: true } } },
  });
  return {
    categories,
    source: "database",
    items: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      price: formatMinor(parseMajorToMinor(p.basePrice.toString()), p.currency),
      discountPrice: p.discountPrice ? formatMinor(parseMajorToMinor(p.discountPrice.toString()), p.currency) : null,
      isFeatured: p.isFeatured,
      isAvailable: p.isAvailable,
      hasOptions: p.variants.length > 0 || p.modifierGroups.length > 0,
    })),
  };
}
