import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { assignDriver } from "./actions";

export const dynamic = "force-dynamic";

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("delivery:assign");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;

  const [orders, drivers] = await Promise.all([
    prisma.order.findMany({
      where: { type: "DELIVERY", status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { delivery: { include: { staff: { select: { fullName: true } } } } },
      orderBy: { placedAt: "asc" },
    }),
    prisma.user.findMany({
      where: { kind: "STAFF", status: "ACTIVE", deletedAt: null, roles: { some: { role: { key: "delivery_staff" } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="page-title"><strong>Dispatch</strong></h1>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {drivers.length === 0 ? (
        <div className="empty">No delivery drivers yet. Create a staff member with the Delivery driver role in Staff.</div>
      ) : null}
      {orders.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>No open delivery orders.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
          {orders.map((o) => (
            <li key={o.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{o.orderNumber}</strong>
                <span className="muted">{o.status.replace(/_/g, " ").toLowerCase()} · {o.paymentStatus.toLowerCase()}</span>
              </div>
              <div style={{ fontWeight: 600 }}>{o.specialInstructions ?? "No address recorded"}</div>
              <div className="muted">
                {o.delivery?.staff ? `Driver: ${o.delivery.staff.fullName} (${o.delivery.status.replace(/_/g, " ").toLowerCase()})` : "Not assigned"}
              </div>
              {drivers.length > 0 ? (
                <form action={assignDriver} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <select name="driverId" required aria-label={`Driver for ${o.orderNumber}`} style={{ padding: 10, borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", font: "inherit" }}>
                    <option value="">Choose a driver</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                  </select>
                  <button className="pill" type="submit">{o.delivery ? "Reassign" : "Assign"}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
