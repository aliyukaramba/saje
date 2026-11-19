import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinor, type Minor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { loadReport, RANGES, type RangeKey } from "../../../lib/reports-data";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { DINE_IN: "Dine-in", PICKUP: "Pickup", DELIVERY: "Delivery", WALK_IN_POS: "Counter", };
const METHOD: Record<string, string> = { CASH: "Cash", TOPIFY: "Topify", BANK_TRANSFER: "Bank transfer", POS_TERMINAL: "Card terminal" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const staff = await staffWith("reports:read");
  if (!staff) redirect("/admin/login");
  const { range: rawRange } = await searchParams;
  const range = (RANGES.find((r) => r.key === rawRange)?.key ?? "today") as RangeKey;
  const report = await loadReport(range);

  return (
    <div>
      <h1 className="page-title"><strong>Reports</strong></h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <nav aria-label="Date range" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RANGES.map((r) => (
            <Link key={r.key} className="pill" aria-current={r.key === range ? "page" : undefined} href={`/admin/reports?range=${r.key}`}>{r.label}</Link>
          ))}
        </nav>
        <Link className="pill" href={`/admin/reports/export?range=${range}`}>Download orders (CSV)</Link>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <section className="card stat-hero">
          <h3>Net sales</h3>
          <div className="big">{formatMinor(report.netMinor as Minor)}</div>
          <p>{report.paidCount} paid order{report.paidCount === 1 ? "" : "s"} · refunds {formatMinor(report.refundsMinor as Minor)}</p>
        </section>
        <section className="card">
          <h3>Average order</h3>
          <div className="big">{formatMinor(report.avgMinor as Minor)}</div>
          <p>Paid orders only</p>
        </section>
        <section className="card">
          <h3>All orders</h3>
          <div className="big">{report.orders.length}</div>
          <p>Not cancelled</p>
        </section>
      </div>

      <div className="home-split" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Orders by type</h3>
          {report.byType.length === 0 ? <p>No orders in this period.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
              {report.byType.map((t) => (
                <li key={t.type} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{LABELS[t.type] ?? t.type}</span>
                  <span>{t.count} · {formatMinor(t.minor)}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 style={{ marginTop: 18 }}>Payments received</h3>
          {report.byMethod.length === 0 ? <p>No payments in this period.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
              {report.byMethod.map((m) => (
                <li key={m.method} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{METHOD[m.method] ?? m.method}</span>
                  <span>{formatMinor(m.minor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>Top dishes</h3>
          {report.topDishes.length === 0 ? <p>No paid sales in this period.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
              {report.topDishes.map((d) => (
                <li key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{d.name} <span className="muted">× {d.qty}</span></span>
                  <span className="price">{formatMinor(d.minor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
