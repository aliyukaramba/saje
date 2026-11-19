import { redirect, notFound } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";
import { staffWith } from "../../../../lib/auth";
import { requestBill, settleAndCloseTable } from "./actions";

export const dynamic = "force-dynamic";

export default async function TableBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await staffWith("tables:serve");
  if (!staff) redirect("/admin/login");
  const { id } = await params;
  const { error } = await searchParams;

  const table = await prisma.diningTable.findUnique({
    where: { id },
    include: {
      sessions: {
        where: { status: { not: "CLOSED" } },
        include: {
          orders: { include: { items: true }, orderBy: { placedAt: "asc" } },
        },
      },
    },
  });
  if (!table) notFound();
  const session = table.sessions[0];
  const canSettle = staff.roleKeys.some((r) => ["super_admin", "restaurant_manager", "cashier"].includes(r));

  const orders = session?.orders ?? [];
  const toMinor = (v: { toString(): string }): Minor => parseMajorToMinor(v.toString());
  const billable = orders.filter((o) => o.status !== "CANCELLED");
  const total = billable.reduce<Minor>((sum, o) => sum + toMinor(o.total), 0n);
  const unpaid = billable.filter((o) => o.paymentStatus !== "PAID").reduce<Minor>((sum, o) => sum + toMinor(o.total), 0n);

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {!session ? (
        <div className="empty" style={{ marginTop: 16 }}>No open bill for this table.</div>
      ) : (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <h2>Open bill</h2>
            <p className="muted">Status: {session.status === "BILL_REQUESTED" ? "Bill requested" : "Open"} · opened {session.openedAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</p>
            <ul style={{ paddingLeft: 18 }}>
              {orders.map((o) => (
                <li key={o.id}>
                  <strong>{o.orderNumber}</strong> · {o.status.replace(/_/g, " ").toLowerCase()} · {o.paymentStatus.toLowerCase()}
                  <ul>{o.items.map((i) => <li key={i.id}>{i.quantity} × {i.nameSnapshot}</li>)}</ul>
                </li>
              ))}
            </ul>
            <p><strong>Total:</strong> {formatMinor(total)} · <strong>Unpaid:</strong> {formatMinor(unpaid)}</p>
          </section>

          <section style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {session.status === "OPEN" ? (
              <form action={requestBill}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="tableId" value={table.id} />
                <button className="pill" type="submit">Request bill</button>
              </form>
            ) : null}
            {canSettle ? (
              <form action={settleAndCloseTable} className="checkout-form">
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="tableId" value={table.id} />
                <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  <legend style={{ fontWeight: 600 }}>How did the customer pay?</legend>
                  <label className="opt-row"><input type="radio" name="paymentMethod" value="CASH" defaultChecked /> <span>Cash</span></label>
                  <label className="opt-row"><input type="radio" name="paymentMethod" value="POS_TERMINAL" /> <span>Card terminal</span></label>
                  <label className="opt-row"><input type="radio" name="paymentMethod" value="BANK_TRANSFER" /> <span>Bank transfer</span></label>
                </fieldset>
                <button className="btn-primary" type="submit">Record payment and close table</button>
              </form>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
