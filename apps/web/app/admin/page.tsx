import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { canAny, formatMinor, parseMajorToMinor, type Minor, type Permission } from "@restaurant/shared";
import { staffWith } from "../../lib/auth";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

// Nigeria is UTC+1 year-round. "Today" starts at local midnight.
function startOfTodayLagos(now: Date): Date {
  const shifted = new Date(now.getTime() + 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3600_000);
}

export default async function AdminHome() {
  const staff = await staffWith("orders:read");
  if (!staff) redirect("/admin/login");
  const canSeeSales = canAny(staff.roleKeys, "reports:read" as Permission) || canAny(staff.roleKeys, "payments:record");

  const now = new Date();
  const todayStart = startOfTodayLagos(now);
  const [todayOrders, openOrders, openTables, recent] = await Promise.all([
    prisma.order.findMany({
      where: { placedAt: { gte: todayStart }, status: { not: "CANCELLED" } },
      select: { placedAt: true, total: true, paymentStatus: true },
    }),
    prisma.order.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.tableSession.count({ where: { status: { not: "CLOSED" } } }),
    prisma.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, status: true, total: true, type: true, placedAt: true },
    }),
  ]);

  const toMinor = (v: { toString(): string }): Minor => parseMajorToMinor(v.toString());
  const salesToday = todayOrders.filter((o) => o.paymentStatus === "PAID").reduce<Minor>((s, o) => s + toMinor(o.total), 0n);

  // Orders per local hour since midnight, shown as bars.
  const hours = Math.max(1, Math.floor((now.getTime() + 3600_000 - todayStart.getTime()) / 3600_000) + 1);
  const counts = Array.from({ length: hours }, () => 0);
  for (const o of todayOrders) {
    const h = Math.floor((o.placedAt.getTime() - todayStart.getTime()) / 3600_000);
    if (h >= 0 && h < hours) counts[h] += 1;
  }
  const max = Math.max(1, ...counts);

  return (
    <div>
      <AdminPageHeader title="Overview" subtitle="Today at a glance" />

      <div className="stat-grid">
        <section className="card stat-hero">
          <h3>Sales today</h3>
          <div className="big">{canSeeSales ? formatMinor(salesToday) : "Restricted"}</div>
          <p>{canSeeSales ? "Paid orders since midnight" : "Ask a manager for sales figures"}</p>
        </section>
        <section className="card">
          <h3>Orders today</h3>
          <div className="big">{todayOrders.length}</div>
          <p>Not cancelled</p>
        </section>
        <section className="card">
          <h3>Open right now</h3>
          <div className="big">{openOrders}</div>
          <p>{openTables} table{openTables === 1 ? "" : "s"} with an open bill</p>
        </section>
      </div>

      <div className="home-split" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Orders by hour</h3>
          <div className="bars" role="img" aria-label={`Orders by hour today: ${counts.join(", ")}`}>
            {counts.map((c, i) => (
              <div key={i} title={`${i}:00 · ${c} orders`} style={{ height: `${Math.round((c / max) * 100)}%` }} />
            ))}
          </div>
          <p style={{ marginTop: 8 }}>Hours since midnight (Lagos time)</p>
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Recent orders</h3>
            <Link className="pill" href="/admin/orders">Open orders</Link>
          </div>
          {recent.length === 0 ? <p>No orders yet.</p> : (
            <ul className="recent-list">
              {recent.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.orderNumber}</strong>
                    <div className="muted">{o.type.replace(/_/g, " ").toLowerCase()} · {o.status.replace(/_/g, " ").toLowerCase()}</div>
                  </div>
                  <span className="price">{formatMinor(toMinor(o.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
