import { redirect } from "next/navigation";
import { prisma, loadMenuFromDb } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { PosRegister, type PosItem } from "../../../components/admin/PosRegister";

export const dynamic = "force-dynamic";

export default async function PosPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  const staff = await staffWith("pos:sell");
  if (!staff) redirect("/admin/login");
  const { error, done } = await searchParams;
  const menu = await loadMenuFromDb(prisma);
  const categoryName = new Map(menu.categories.map((c) => [c.id, c.name]));
  const items: PosItem[] = menu.items
    .filter((i) => i.isAvailable)
    .map((i) => ({ id: i.id, name: i.name, price: i.discountPrice ?? i.price, categoryName: categoryName.get(i.categoryId) ?? "", options: i.options }));

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {done ? <p role="status" className="card">Sale {done} is paid and sent to the kitchen.</p> : null}
      <div style={{ marginTop: 16 }}>
        <PosRegister items={items} />
      </div>
    </div>
  );
}
