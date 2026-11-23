import type { PrismaClient } from "@prisma/client";
import { formatMinor, parseMajorToMinor } from "@restaurant/shared";

export interface OptionModifierView { id: string; name: string; delta: string; isAvailable: boolean }
export interface OptionGroupView { id: string; name: string; isRequired: boolean; minSelect: number; maxSelect: number; modifiers: OptionModifierView[] }
export interface OptionVariantView { id: string; name: string; delta: string; isAvailable: boolean }
/** Everything the options picker needs. Money is in kobo as strings so it survives the trip to the browser. */
export interface OptionsView { unitMinor: string; variants: OptionVariantView[]; groups: OptionGroupView[] }

export interface MenuItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: string;
  discountPrice: string | null;
  /** Kobo as strings, for totals in the mobile app. */
  priceMinor: string;
  discountPriceMinor: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  /** True when the product has variants or modifiers. */
  hasOptions: boolean;
  /** Present only when hasOptions is true. */
  options: OptionsView | null;
}

export interface MenuData {
  categories: { id: string; name: string }[];
  items: MenuItemView[];
  source: "database";
}

const minorOf = (v: { toString(): string }) => parseMajorToMinor(v.toString());

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
    include: {
      category: { select: { name: true } },
      variants: true,
      modifierGroups: { include: { modifiers: true } },
    },
  });
  return {
    categories,
    source: "database",
    items: products.map((p) => {
      const hasOptions = p.variants.length > 0 || p.modifierGroups.length > 0;
      const base = minorOf(p.basePrice);
      const discount = p.discountPrice ? minorOf(p.discountPrice) : null;
      const unit = discount !== null && discount < base ? discount : base;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        price: formatMinor(base, p.currency),
        discountPrice: discount !== null ? formatMinor(discount, p.currency) : null,
        priceMinor: base.toString(),
        discountPriceMinor: discount !== null ? discount.toString() : null,
        isFeatured: p.isFeatured,
        isAvailable: p.isAvailable,
        hasOptions,
        options: hasOptions
          ? {
              unitMinor: unit.toString(),
              variants: p.variants.map((v) => ({ id: v.id, name: v.name, delta: minorOf(v.priceDelta).toString(), isAvailable: v.isAvailable })),
              groups: p.modifierGroups.map((g) => ({
                id: g.id, name: g.name, isRequired: g.isRequired, minSelect: g.minSelect, maxSelect: g.maxSelect,
                modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, delta: minorOf(m.priceDelta).toString(), isAvailable: m.isAvailable })),
              })),
            }
          : null,
      };
    }),
  };
}
