import { redirect } from "next/navigation";
import { staffWith } from "../../../lib/auth";
import { loadOpenOrders } from "../../../lib/admin-orders";
import { OrderCard } from "../../../components/admin/OrderCard";
import { AutoRefresh } from "../../../components/admin/AutoRefresh";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

// Kitchen view: only paid orders that still need cooking, refreshed every 10 seconds.
export default async function KitchenPage() {
  const staff = await staffWith("kitchen:view");
  if (!staff) redirect("/admin/login");
  const orders = (await loadOpenOrders()).filter((o) => o.status !== "PENDING" && o.status !== "OUT_FOR_DELIVERY");

  return (
    <div className="shell" style={{ paddingTop: 24 }}>
      <AutoRefresh seconds={10} />
      <AdminPageHeader title="Kitchen" subtitle="Tickets for the kitchen, oldest first" />
      {orders.length === 0 ? (
        <div className="empty">Nothing to cook right now.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {orders.map((o) => <OrderCard key={o.id} order={o} canCancel={false} back="/admin/kitchen" />)}
        </ul>
      )}
    </div>
  );
}
