import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { createTable, issueTableLink, dismissTableLink } from "./actions";
import { QR_ONCE_COOKIE } from "../../../lib/qr-cookie";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function TablesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("tables:manage");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const jar = await cookies();
  const once = jar.get(QR_ONCE_COOKIE)?.value;
  let newLink: { number: string; url: string } | null = null;
  if (once) {
    try {
      const parsed = JSON.parse(once) as { number: string; token: string };
      const base = process.env.PUBLIC_SITE_URL ?? "";
      newLink = { number: parsed.number, url: `${base}/t/${parsed.token}` };
    } catch { /* ignore a malformed cookie */ }
  }
  const tables = await prisma.diningTable.findMany({ orderBy: { number: "asc" } });

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <AdminPageHeader title="Tables" subtitle="Table QR links and open bills" />
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {newLink ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>New link for table {newLink.number}</h2>
          <p>Print this link as a QR code and place it on the table. It is shown only now. Issuing a new link disables this one.</p>
          <p style={{ wordBreak: "break-all" }}><code>{newLink.url}</code></p>
          <form action={dismissTableLink}><button className="pill" type="submit">Done</button></form>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Add table</h2>
        <form action={createTable} className="checkout-form">
          <label>Table number <input name="number" required maxLength={20} /></label>
          <label>Name (optional) <input name="name" maxLength={60} /></label>
          <button className="btn-primary" type="submit">Add table</button>
        </form>
      </section>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
        {tables.map((t) => (
          <li key={t.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div><strong>Table {t.number}</strong>{t.name ? <span className="muted"> · {t.name}</span> : null}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="pill" href={`/admin/tables/${t.id}`}>Bill</Link>
              <form action={issueTableLink}>
                <input type="hidden" name="tableId" value={t.id} />
                <button className="pill" type="submit">New QR link</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
