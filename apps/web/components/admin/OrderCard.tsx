import { nextAllowedStatuses, type OrderStatus } from "@restaurant/shared";
import { advanceOrder } from "../../app/admin/orders/actions";

export interface OrderCardData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  guestName: string | null;
  scheduledFor: string | null;
  total: string;
  items: { quantity: number; nameSnapshot: string }[];
  type?: string;
  notes?: string | null;
}

export function OrderCard({ order, canCancel, back }: { order: OrderCardData; canCancel: boolean; back: string }) {
  const moves = nextAllowedStatuses(order.status).filter((s) => s !== "CONFIRMED" && (s !== "CANCELLED" || canCancel));
  return (
    <li className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{order.orderNumber}</strong>
        <span className="pill" aria-label="Order status">{order.status.replace(/_/g, " ")}</span>
      </div>
      <div className="muted">
        {order.guestName ?? "Guest"} · {order.paymentStatus.toLowerCase()} · {order.total}
        {order.scheduledFor ? ` · pickup ${new Date(order.scheduledFor).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : ""}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {order.items.map((i, idx) => <li key={idx}>{i.quantity} × {i.nameSnapshot}</li>)}
      </ul>
      {order.type === "DELIVERY" && order.notes ? <div style={{ fontWeight: 600 }}>{order.notes}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a className="pill" href={`/admin/receipts/${order.orderNumber}`} target="_blank" rel="noopener">Receipt</a>
        {moves.map((to) => (
          <form key={to} action={advanceOrder}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="to" value={to} />
            <input type="hidden" name="back" value={back} />
            <button className="pill" type="submit">{to === "CANCELLED" ? "Cancel order" : `Mark ${to.replace(/_/g, " ").toLowerCase()}`}</button>
          </form>
        ))}
      </div>
    </li>
  );
}
