import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../../lib/auth";
import { updateProduct } from "../actions";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

const naira = (v: { toString(): string } | null) => (v ? String(Number(parseMajorToMinor(v.toString())) / 100) : "");

export default async function EditDishPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await staffWith("menu:manage");
  if (!staff) redirect("/admin/login");
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({ where: { id, deletedAt: null } }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  return (
    <div>
      <p><Link href="/admin/menu" className="pill">← Back to menu</Link></p>
      <AdminPageHeader title="Edit dish" subtitle="Update the name, price and details" />
      <section className="card" style={{ maxWidth: 560 }}>
        <form action={updateProduct} className="checkout-form">
          <input type="hidden" name="id" value={product.id} />
          <label>Name
            <input name="name" required minLength={2} maxLength={120} defaultValue={product.name} />
          </label>
          <label>Description (optional)
            <textarea name="description" rows={3} maxLength={500} defaultValue={product.description ?? ""} />
          </label>
          <label>Category
            <select name="categoryId" defaultValue={product.categoryId} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Price (₦)
            <input name="price" inputMode="decimal" required defaultValue={naira(product.basePrice)} />
          </label>
          <label>Discount price (₦, optional, leave empty for none)
            <input name="discountPrice" inputMode="decimal" defaultValue={naira(product.discountPrice)} />
          </label>
          <button className="btn-primary" type="submit">Save dish</button>
        </form>
      </section>
    </div>
  );
}
