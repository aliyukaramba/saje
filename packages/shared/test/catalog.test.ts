import { describe, it, expect } from "vitest";
import { priceCart, CatalogError, type CatalogProduct } from "../src/catalog/pricing";

const pizza: CatalogProduct = {
  id: "p1", name: "Margherita", basePrice: 500000n, discountPrice: 450000n, isAvailable: true,
  variants: [
    { id: "v-s", name: "Small", priceDelta: -50000n, isAvailable: true },
    { id: "v-l", name: "Large", priceDelta: 100000n, isAvailable: true },
  ],
  modifierGroups: [
    { id: "g1", name: "Extras", isRequired: false, minSelect: 0, maxSelect: 2, modifiers: [
      { id: "m-cheese", name: "Extra cheese", priceDelta: 50000n, isAvailable: true },
      { id: "m-olive", name: "Olives", priceDelta: 30000n, isAvailable: false },
    ] },
  ],
};
const products = new Map([[pizza.id, pizza]]);

describe("catalog pricing", () => {
  it("uses the discount price when it is lower, then applies the variant delta", () => {
    const cart = priceCart([{ productId: "p1", variantId: "v-l", modifierIds: [], quantity: 1 }], products);
    expect(cart.lines[0].unitPrice).toBe(550000n); // 4500 + 1000
  });

  it("ignores a discount price that is not lower than base", () => {
    const p = { ...pizza, discountPrice: 900000n, variants: [] };
    const cart = priceCart([{ productId: "p1", modifierIds: [], quantity: 2 }], new Map([[p.id, p]]));
    expect(cart.lines[0].unitPrice).toBe(500000n);
  });

  it("requires a variant when the product has variants", () => {
    expect(() => priceCart([{ productId: "p1", modifierIds: [], quantity: 1 }], products))
      .toThrow(CatalogError);
  });

  it("adds modifier prices and respects quantity", () => {
    const cart = priceCart([{ productId: "p1", variantId: "v-s", modifierIds: ["m-cheese"], quantity: 3 }], products);
    expect(cart.lines[0].lineTotal).toBe((450000n - 50000n + 50000n) * 3n);
  });

  it("rejects unavailable modifiers and unknown modifiers", () => {
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: ["m-olive"], quantity: 1 }], products))
      .toThrow(/unavailable/);
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: ["nope"], quantity: 1 }], products))
      .toThrow(/does not belong/);
  });

  it("enforces required and maximum modifier selections", () => {
    const strict = {
      ...pizza,
      modifierGroups: [{ id: "g", name: "Sauce", isRequired: true, minSelect: 1, maxSelect: 1, modifiers: [
        { id: "a", name: "A", priceDelta: 0n, isAvailable: true },
        { id: "b", name: "B", priceDelta: 0n, isAvailable: true },
      ] }],
    };
    const map = new Map([[strict.id, strict]]);
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: [], quantity: 1 }], map)).toThrow(/Choose/);
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: ["a", "b"], quantity: 1 }], map)).toThrow(/Too many/);
  });

  it("rejects empty carts, bad quantities and duplicate modifiers", () => {
    expect(() => priceCart([], products)).toThrow(/empty/);
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: [], quantity: 0 }], products)).toThrow();
    expect(() => priceCart([{ productId: "p1", variantId: "v-s", modifierIds: ["m-cheese", "m-cheese"], quantity: 1 }], products)).toThrow(/Duplicate/);
  });

  it("computes cart totals from catalog prices only", () => {
    const cart = priceCart([{ productId: "p1", variantId: "v-s", modifierIds: [], quantity: 2 }], products, { taxRateBps: 750 });
    expect(cart.totals.subtotal).toBe(800000n);
    expect(cart.totals.tax).toBe(60000n);
    expect(cart.totals.total).toBe(860000n);
  });
});
