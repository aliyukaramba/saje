import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { markPickedUp, markDelivered, markFailed } from "./actions";

export const dynamic = "force-dynamic";

export default async function DriverPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("delivery:update_own");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const mine = await prisma.deliveryAssignment.findMany({
    where: { staffId: staff.user.id, status: { in: ["ASSIGNED", "PICKED_UP"] } },
    include: { order: true },
    orderBy: { assignedAt: "asc" },
  });

  return (
    <div>
      <h1 className="page-title"><strong>My</strong> deliveries</h1>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {mine.length === 0 ? (
        <div className="empty">No deliveries assigned to you right now.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {mine.map((a) => {
            const readyToCollect = a.status === "ASSIGNED" && a.order.status === "READY";
            return (
              <li key={a.id} className="card" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{a.order.orderNumber}</strong>
                  <span className="muted">{a.status === "ASSIGNED" ? "Assigned" : "On the way"}</span>
                </div>
                <div style={{ fontWeight: 600 }}>{a.order.specialInstructions ?? "No address recorded"}</div>
                <div className="muted">
                  {a.status === "ASSIGNED" && !readyToCollect ? "Waiting for the kitchen to finish." : null}
                  {readyToCollect ? "Ready to collect." : null}
                  {a.status === "PICKED_UP" ? `Payment: ${a.order.paymentStatus.toLowerCase()}` : null}
                </div>

                {readyToCollect ? (
                  <form action={markPickedUp}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <button className="btn-primary" type="submit">Picked up</button>
                  </form>
                ) : null}

                {a.status === "PICKED_UP" ? (
                  <form action={markDelivered}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <button className="btn-primary" type="submit">Delivered</button>
                  </form>
                ) : null}

                <form action={markFailed} className="checkout-form">
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <label>Could not deliver? Say why
                    <input name="reason" required minLength={3} maxLength={200} />
                  </label>
                  <button className="pill" type="submit">Report failed delivery</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
