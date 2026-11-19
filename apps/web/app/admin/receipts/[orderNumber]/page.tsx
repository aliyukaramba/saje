import { notFound, redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";
import { staffWith } from "../../../../lib/auth";
import { PrintButton } from "../../../../components/admin/PrintButton";
import { issueRefund } from "./actions";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { DINE_IN: "Dine-in", PICKUP: "Pickup", DELIVERY: "Delivery", WALK_IN_POS: "Counter sale" };
const METHOD: Record<string, string> = { CASH: "Cash", TOPIFY: "Topify", BANK_TRANSFER: "Bank transfer", POS_TERMINAL: "Card terminal" };

const money = (v: { toString(): string }) => formatMinor(parseMajorToMinor(v.toString()));
const nonZero = (v: { toString(): string }) => parseMajorToMinor(v.toString()) !== 0n;

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ refund?: string }>;
}) {
  const staff = await staffWith("orders:read");
  if (!staff) redirect("/admin/login");
  const { orderNumber } = await params;
  const { refund } = await searchParams;
  const canRefund = (await staffWith("refunds:issue")) !== null;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { modifiers: true } }, payments: { include: { refunds: true } } },
  });
  if (!order) notFound();

  // Payments that still have something left to refund.
  const refundable = order.payments
    .filter((p) => p.status === "SUCCESSFUL" || p.status === "PARTIALLY_REFUNDED")
    .map((p) => {
      const refundedMinor = p.refunds
        .filter((r) => r.status === "SUCCESSFUL")
        .reduce((s, r) => s + parseMajorToMinor(r.amount.toString()), 0n);
      return { ...p, leftMinor: parseMajorToMinor(p.amount.toString()) - refundedMinor };
    })
    .filter((p) => p.leftMinor > 0n);

  return (
    <div className="receipt-wrap">
      <div className="receipt" aria-label={`Receipt ${order.orderNumber}`}>
        <div className="receipt-head">
          <strong>{process.env.RESTAURANT_NAME ?? "Restaurant"}</strong>
          <div>Receipt</div>
        </div>

        <dl className="receipt-meta">
          <dt>Order</dt><dd>{order.orderNumber}</dd>
          <dt>Date</dt><dd>{order.placedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}</dd>
          <dt>Type</dt><dd>{TYPE[order.type] ?? order.type}</dd>
          {order.guestName ? (<><dt>Customer</dt><dd>{order.guestName}</dd></>) : null}
        </dl>

        <table className="receipt-items">
          <thead>
            <tr><th scope="col">Item</th><th scope="col" style={{ textAlign: "right" }}>Amount</th></tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const options = item.modifiers.map((m) => m.nameSnapshot).join(", ");
              return (
                <tr key={item.id}>
                  <td>
                    {item.quantity} × {item.nameSnapshot}
                    {options ? <div className="receipt-opt">{options}</div> : null}
                  </td>
                  <td style={{ textAlign: "right" }}>{money(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="receipt-totals">
          <dt>Subtotal</dt><dd>{money(order.subtotal)}</dd>
          {nonZero(order.discountTotal) ? (<><dt>Discount</dt><dd>−{money(order.discountTotal)}</dd></>) : null}
          {nonZero(order.taxTotal) ? (<><dt>Tax</dt><dd>{money(order.taxTotal)}</dd></>) : null}
          {nonZero(order.deliveryFee) ? (<><dt>Delivery fee</dt><dd>{money(order.deliveryFee)}</dd></>) : null}
          <dt className="receipt-grand">Total</dt><dd className="receipt-grand">{formatMinor(parseMajorToMinor(order.total.toString()) as Minor)}</dd>
        </dl>

        <div className="receipt-pay">
          {order.payments.length === 0 ? <div>Not yet paid</div> : order.payments.map((p) => (
            <div key={p.id}>
              <div>{METHOD[p.method] ?? p.method} · {p.status.toLowerCase()} · {money(p.amount)}</div>
              {p.cashTendered ? <div className="receipt-opt">Cash received {money(p.cashTendered)} · change {money(p.changeGiven ?? "0")}</div> : null}
            </div>
          ))}
        </div>

        <p className="receipt-foot">Thank you for your order.</p>
      </div>

      {canRefund && refundable.length > 0 ? (
        <section className="card no-print" style={{ width: "100%", maxWidth: 340, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Refund</h3>
          {refund === "done" ? <p role="status" className="muted">Refund recorded.</p> : null}
          {refund && refund !== "done" ? <p className="form-error" role="alert">{refund}</p> : null}
          {refundable.map((p) => (
            <form key={p.id} action={issueRefund} className="checkout-form">
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <input type="hidden" name="paymentId" value={p.id} />
              <label>Amount, up to {formatMinor(p.leftMinor as Minor)}
                <input name="amount" inputMode="decimal" required placeholder={String(Number(p.leftMinor) / 100)} />
              </label>
              <label>Reason
                <input name="reason" required minLength={3} maxLength={200} placeholder="e.g. wrong order" />
              </label>
              <button className="pill" type="submit">Refund {METHOD[p.method] ?? p.method}</button>
            </form>
          ))}
        </section>
      ) : null}

      <div className="receipt-actions no-print">
        <PrintButton />
        <a className="pill" href="/admin/orders">Back to orders</a>
      </div>
    </div>
  );
}
