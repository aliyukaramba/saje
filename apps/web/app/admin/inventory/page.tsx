import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { isLowStock } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { createInventoryItem, restockItem, recordCount, addRecipeLine } from "./actions";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("inventory:manage");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;

  const [items, products, recipes] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.recipe.findMany({ include: { product: { select: { name: true } }, ingredients: { include: { inventoryItem: { select: { name: true, unit: true } } } } } }),
  ]);
  const low = items.filter((i) => isLowStock(Number(i.quantityOnHand.toString()), Number(i.reorderLevel.toString())));

  const field = { width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", font: "inherit" } as const;

  return (
    <div>
      <AdminPageHeader title="Inventory" subtitle="Stock levels, restocks and recipes" />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {low.length > 0 ? (
        <div className="card" role="alert" style={{ borderLeft: "4px solid var(--danger)", marginTop: 12 }}>
          <strong>Low stock:</strong> {low.map((i) => i.name).join(", ")}
        </div>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
        {items.length === 0 ? <li className="empty">No stock items yet. Add one below.</li> : null}
        {items.map((i) => {
          const onHand = Number(i.quantityOnHand.toString());
          const reorder = Number(i.reorderLevel.toString());
          const short = onHand < 0;
          return (
            <li key={i.id} className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{i.name}</strong>
                <span className="muted">
                  {onHand} {i.unit} on hand · reorder at {reorder}
                  {short ? " · short" : isLowStock(onHand, reorder) ? " · low" : ""}
                </span>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <form action={restockItem} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="itemId" value={i.id} />
                  <input name="quantity" type="number" min="0" step="any" required placeholder="Received" aria-label={`Received for ${i.name}`} style={field} />
                  <button className="pill" type="submit">Add stock</button>
                </form>
                <form action={recordCount} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="itemId" value={i.id} />
                  <input name="counted" type="number" min="0" step="any" required placeholder="Counted" aria-label={`Counted for ${i.name}`} style={field} />
                  <button className="pill" type="submit">Set count</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Add stock item</h2>
        <form action={createInventoryItem} className="checkout-form">
          <label>Name <input name="name" required minLength={2} maxLength={80} /></label>
          <label>Unit
            <select name="unit" required style={field}>
              <option value="g">grams (g)</option>
              <option value="ml">millilitres (ml)</option>
              <option value="piece">pieces</option>
            </select>
          </label>
          <label>Reorder level <input name="reorderLevel" type="number" min="0" step="any" defaultValue="0" /></label>
          <label>Cost per unit in naira <input name="cost" inputMode="decimal" defaultValue="0" /></label>
          <button className="btn-primary" type="submit">Add item</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Dish recipes</h2>
        <p className="muted">Each sale takes these amounts from stock when the kitchen accepts the order.</p>
        {recipes.length === 0 ? <p>No recipes yet.</p> : (
          <ul style={{ paddingLeft: 18 }}>
            {recipes.map((r) => (
              <li key={r.id}>
                <strong>{r.product.name}</strong>: {r.ingredients.map((l) => `${Number(l.quantity.toString())} ${l.inventoryItem.unit} ${l.inventoryItem.name}`).join(", ") || "no ingredients"}
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && products.length > 0 ? (
          <form action={addRecipeLine} className="checkout-form" style={{ marginTop: 12 }}>
            <label>Dish
              <select name="productId" required style={field}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Ingredient
              <select name="itemId" required style={field}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
            </label>
            <label>Amount per portion (whole units) <input name="quantity" type="number" min="1" step="1" required /></label>
            <button className="btn-primary" type="submit">Add to recipe</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
