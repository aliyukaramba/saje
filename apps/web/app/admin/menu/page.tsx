import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
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

  return (
    <div className="shell" style={{ paddingTop: 32 }}>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Categories</h2>
        <ul>{categories.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
        <form action={createCategory} className="checkout-form">
          <label>New category <input name="name" required minLength={2} maxLength={60} /></label>
          <button className="btn-primary" type="submit">Add category</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Add dish</h2>
        {categories.length === 0 ? <p>Add a category first.</p> : (
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

      <section style={{ marginTop: 16 }}>
        <h2>Dishes</h2>
        <ul className="cart-lines">
          {products.map((p) => (
            <li key={p.id} className="card cart-line">
              <div>
                <strong>{p.name}</strong>
                <div className="muted">{p.category.name} · {formatMinor(parseMajorToMinor(p.basePrice.toString()))}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link className="pill" href={`/admin/menu/${p.id}`}>Edit</Link>
                <form action={updateProductAvailability}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="available" value={String(p.isAvailable)} />
                  <button className="pill" type="submit">{p.isAvailable ? "Hide" : "Show"}</button>
                </form>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="pill" type="submit">Delete</button>
                </form>
              </div>
              <form action={uploadProductImage} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="productId" value={p.id} />
                {p.imageUrl ? <img src={p.imageUrl} alt="" width={48} height={48} style={{ objectFit: "cover", borderRadius: 12 }} /> : null}
                <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label={`Photo for ${p.name}`} />
                <button className="pill" type="submit">Upload photo</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
