import { redirect } from "next/navigation";
import { canAny } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { loadOpenOrders } from "../../../lib/admin-orders";
import { OrderCard } from "../../../components/admin/OrderCard";
import { AutoRefresh } from "../../../components/admin/AutoRefresh";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("orders:read");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const orders = await loadOpenOrders();
  const canCancel = canAny(staff.roleKeys, "orders:cancel");

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <AdminPageHeader title="Orders" subtitle="Open orders, updated as they change" />
      <AutoRefresh seconds={20} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {orders.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>No open orders.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
          {orders.map((o) => <OrderCard key={o.id} order={o} canCancel={canCancel} back="/admin/orders" />)}
        </ul>
      )}
    </div>
  );
}
