import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { DINE_IN: "Dine-in", PICKUP: "Pickup", DELIVERY: "Delivery", WALK_IN_POS: "Counter" };
const STATUS: Record<string, string> = { PAID: "Paid", UNPAID: "Unpaid", PARTIALLY_REFUNDED: "Partly refunded", REFUNDED: "Refunded" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await staffWith("orders:read");
  if (!staff) redirect("/admin/login");
  const { q } = await searchParams;
  const term = (q ?? "").trim().toUpperCase().slice(0, 40);

  const orders = await prisma.order.findMany({
    where: term ? { orderNumber: { contains: term } } : {},
    orderBy: { placedAt: "desc" },
    take: 50,
    select: { orderNumber: true, placedAt: true, type: true, total: true, paymentStatus: true, guestName: true },
  });

  return (
    <div>
      <AdminPageHeader title="Receipts" subtitle="Find and print any receipt, or issue a refund" />
      <p className="muted">Open any receipt to print it or to issue a refund.</p>

      <form method="get" action="/admin/receipts" style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search by order number" aria-label="Search by order number" style={{ flex: "1 1 240px" }} />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {orders.length === 0 ? (
        <p className="muted">No receipts found{term ? ` for “${term}”` : ""}.</p>
      ) : (
        <ul className="cart-lines">
          {orders.map((o) => (
            <li key={o.orderNumber} className="card cart-line">
              <div>
                <strong>{o.orderNumber}</strong>
                <div className="muted">
                  {o.placedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}
                  {" · "}{TYPE[o.type] ?? o.type}{o.guestName ? ` · ${o.guestName}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", display: "grid", gap: 6, justifyItems: "end" }}>
                <span className="price">{formatMinor(parseMajorToMinor(o.total.toString()) as Minor)}</span>
                <span className="muted">{STATUS[o.paymentStatus] ?? o.paymentStatus}</span>
                <Link className="pill" href={`/admin/receipts/${encodeURIComponent(o.orderNumber)}`}>Open receipt</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
