import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { Icon } from "../../../components/Icon";
import { createCategory, createProduct, updateProductAvailability, deleteProduct, uploadProductImage } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("menu:manage");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null }, include: { category: true }, orderBy: { name: "asc" } }),
  ]);

  const countByCategory = new Map<string, number>();
  for (const p of products) countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
  const available = products.filter((p) => p.isAvailable).length;

  return (
    <div className="menu-admin">
      <header className="menu-head">
        <div>
          <h1 className="page-title">Menu</h1>
          <p className="muted">
            {products.length} dish{products.length === 1 ? "" : "es"} · {available} available · {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <a className="btn-primary" href="#new-dish">
          <Icon name="plus" size={16} /> New dish
        </a>
      </header>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="menu-layout">
        <section aria-label="Dishes">
          {products.length === 0 ? (
            <div className="card menu-empty">No dishes yet. Add your first dish to get started.</div>
          ) : (
            <ul className="menu-grid">
              {products.map((p) => (
                <li key={p.id} className={`card menu-card${p.isAvailable ? "" : " is-hidden"}`}>
                  <div className="menu-media">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="menu-media-empty" aria-hidden="true"><Icon name="image" size={30} /></div>
                    )}
                    <span className={`menu-badge ${p.isAvailable ? "on" : "off"}`}>{p.isAvailable ? "Available" : "Hidden"}</span>
                  </div>

                  <div className="menu-body">
                    <span className="menu-cat">{p.category.name}</span>
                    <h3 className="menu-name">{p.name}</h3>
                    {p.description ? <p className="menu-desc">{p.description}</p> : null}
                    <div className="menu-price">{formatMinor(parseMajorToMinor(p.basePrice.toString()))}</div>
                  </div>

                  <div className="menu-actions">
                    <Link className="pill" href={`/admin/menu/${p.id}`}>Edit</Link>
                    <form action={updateProductAvailability}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="available" value={String(p.isAvailable)} />
                      <button className="pill" type="submit">{p.isAvailable ? "Hide" : "Show"}</button>
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="pill menu-danger" type="submit">Delete</button>
                    </form>
                  </div>

                  <details className="menu-photo">
                    <summary>{p.imageUrl ? "Change photo" : "Add photo"}</summary>
                    <form action={uploadProductImage} className="menu-upload">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label={`Photo for ${p.name}`} />
                      <button className="pill" type="submit">Upload</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="menu-side">
          <section className="card" id="new-dish">
            <h3 className="menu-h">New dish</h3>
            {categories.length === 0 ? (
              <p className="muted">Add a category first, then you can add dishes to it.</p>
            ) : (
              <form action={createProduct} className="checkout-form">
                <label>Category
                  <select name="categoryId" required>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>Name <input name="name" required minLength={2} maxLength={120} /></label>
                <label>Description <input name="description" maxLength={500} /></label>
                <label>Price in naira <input name="price" required inputMode="decimal" placeholder="4500" /></label>
                <button className="btn-primary" type="submit">Add dish</button>
              </form>
            )}
          </section>

          <section className="card">
            <h3 className="menu-h">Categories</h3>
            {categories.length === 0 ? (
              <p className="muted">No categories yet.</p>
            ) : (
              <ul className="menu-cats">
                {categories.map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <span className="menu-count">{countByCategory.get(c.id) ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={createCategory} className="checkout-form">
              <label>New category <input name="name" required minLength={2} maxLength={60} /></label>
              <button className="pill" type="submit">Add category</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
