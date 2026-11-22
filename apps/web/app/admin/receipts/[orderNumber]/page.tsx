import { notFound, redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";
import { staffWith } from "../../../../lib/auth";
import { PrintButton } from "../../../../components/admin/PrintButton";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { DINE_IN: "Dine-in", PICKUP: "Pickup", DELIVERY: "Delivery", WALK_IN_POS: "Counter sale" };
const METHOD: Record<string, string> = { CASH: "Cash", TOPIFY: "Topify", BANK_TRANSFER: "Bank transfer", POS_TERMINAL: "Card terminal" };

const money = (v: { toString(): string }) => formatMinor(parseMajorToMinor(v.toString()));
const nonZero = (v: { toString(): string }) => parseMajorToMinor(v.toString()) !== 0n;

export default async function ReceiptPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const staff = await staffWith("orders:read");
  if (!staff) redirect("/admin/login");
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { modifiers: true } }, payments: true },
  });
  if (!order) notFound();

  return (
    <div className="receipt-wrap">
      <AdminPageHeader title="Receipt" subtitle="Print this receipt or issue a refund" />
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
            <div key={p.id}>{METHOD[p.method] ?? p.method} · {p.status.toLowerCase()} · {money(p.amount)}</div>
          ))}
        </div>

        <p className="receipt-foot">Thank you for your order.</p>
      </div>

      <div className="receipt-actions no-print">
        <PrintButton />
        <a className="pill" href="/admin/orders">Back to orders</a>
      </div>
    </div>
  );
}
