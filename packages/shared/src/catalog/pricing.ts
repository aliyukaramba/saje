import { computeTotals, type Minor, type Totals } from "../money";

export interface CatalogModifier {
  id: string;
  name: string;
  priceDelta: Minor;
  isAvailable: boolean;
}

export interface CatalogModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: CatalogModifier[];
}

export interface CatalogVariant {
  id: string;
  name: string;
  priceDelta: Minor;
  isAvailable: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  basePrice: Minor;
  discountPrice: Minor | null;
  isAvailable: boolean;
  variants: CatalogVariant[];
  modifierGroups: CatalogModifierGroup[];
}

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

/** Effective unit price before modifiers: discount price if set and lower, plus variant delta. */
export function resolveUnitPrice(product: CatalogProduct, variantId?: string): Minor {
  let base = product.discountPrice !== null && product.discountPrice < product.basePrice
    ? product.discountPrice
    : product.basePrice;
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw new CatalogError("Unknown variant");
    if (!variant.isAvailable) throw new CatalogError("Variant is unavailable");
    base += variant.priceDelta;
  } else if (product.variants.length > 0) {
    throw new CatalogError("A variant must be chosen for this product");
  }
  return base;
}

/** Checks a modifier selection against group rules and returns the summed price delta. */
export function resolveModifierTotal(product: CatalogProduct, selectedModifierIds: readonly string[]): Minor {
  const selected = new Set(selectedModifierIds);
  if (selected.size !== selectedModifierIds.length) throw new CatalogError("Duplicate modifier selected");
  let total = 0n;
  const known = new Set<string>();
  for (const group of product.modifierGroups) {
    const chosen = group.modifiers.filter((m) => selected.has(m.id));
    for (const m of group.modifiers) known.add(m.id);
    if (chosen.length < group.minSelect || (group.isRequired && chosen.length === 0)) {
      throw new CatalogError(`Choose at least ${Math.max(group.minSelect, 1)} option(s) for ${group.name}`);
    }
    if (chosen.length > group.maxSelect) throw new CatalogError(`Too many options for ${group.name}`);
    for (const m of chosen) {
      if (!m.isAvailable) throw new CatalogError(`${m.name} is unavailable`);
      total += m.priceDelta;
    }
  }
  for (const id of selectedModifierIds) {
    if (!known.has(id)) throw new CatalogError("Modifier does not belong to this product");
  }
  return total;
}

export interface CartLineInput {
  productId: string;
  variantId?: string;
  modifierIds: string[];
  quantity: number;
}

export interface PricedCartLine {
  productId: string;
  variantId: string | null;
  modifierIds: string[];
  quantity: number;
  unitPrice: Minor;
  modifierTotal: Minor;
  lineTotal: Minor;
}

export interface PricedCart {
  lines: PricedCartLine[];
  totals: Totals;
}

/** Prices a cart against the catalog. Never trusts client-supplied prices. */
export function priceCart(
  lines: readonly CartLineInput[],
  products: ReadonlyMap<string, CatalogProduct>,
  opts: { discount?: Minor; taxRateBps?: number; deliveryFee?: Minor } = {},
): PricedCart {
  if (lines.length === 0) throw new CatalogError("Cart is empty");
  const priced: PricedCartLine[] = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new CatalogError("Quantity must be between 1 and 99");
    }
    const product = products.get(line.productId);
    if (!product) throw new CatalogError("Unknown product");
    if (!product.isAvailable) throw new CatalogError(`${product.name} is unavailable`);
    const unitPrice = resolveUnitPrice(product, line.variantId);
    const modifierTotal = resolveModifierTotal(product, line.modifierIds);
    return {
      productId: line.productId,
      variantId: line.variantId ?? null,
      modifierIds: [...line.modifierIds],
      quantity: line.quantity,
      unitPrice,
      modifierTotal,
      lineTotal: (unitPrice + modifierTotal) * BigInt(line.quantity),
    };
  });
  const totals = computeTotals(
    priced.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, modifierTotal: l.modifierTotal })),
    opts,
  );
  return { lines: priced, totals };
}
