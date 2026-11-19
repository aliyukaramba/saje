"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../../lib/auth";

function back(tableId: string, error?: string): never {
  redirect(error ? `/admin/tables/${tableId}?error=${encodeURIComponent(error)}` : `/admin/tables/${tableId}`);
}

/** Marks the open session as BILL_REQUESTED. New orders are refused from then on. */
export async function requestBill(formData: FormData) {
  const staff = await staffWith("tables:serve");
  if (!staff) redirect("/admin/login");
  const sessionId = String(formData.get("sessionId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  const res = await prisma.tableSession.updateMany({
    where: { id: sessionId, status: "OPEN" },
    data: { status: "BILL_REQUESTED" },
  });
  if (res.count === 0) back(tableId, "The bill is already requested or the table is closed");
  revalidatePath(`/admin/tables/${tableId}`);
  back(tableId);
}

/**
 * Records the chosen payment (cash, card terminal or bank transfer) for every unpaid order on the table,
 * completes ready orders, and closes the session. Blocked while any order is still being prepared,
 * so the kitchen is never bypassed.
 */
export async function settleAndCloseTable(formData: FormData) {
  const staff = await staffWith("payments:record");
  if (!staff) redirect("/admin/login");
  const sessionId = String(formData.get("sessionId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  const methodRaw = String(formData.get("paymentMethod") ?? "CASH");
  if (!(["CASH", "POS_TERMINAL", "BANK_TRANSFER"] as string[]).includes(methodRaw)) {
    back(tableId, "Choose how the customer paid");
  }
  const method = methodRaw as "CASH" | "POS_TERMINAL" | "BANK_TRANSFER";

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { orders: true },
  });
  if (!session || session.status === "CLOSED") back(tableId, "This table is already closed");

  const stillCooking = session.orders.some((o) => !["READY", "COMPLETED", "CANCELLED"].includes(o.status));
  if (stillCooking) back(tableId, "Some orders are still in the kitchen");

  const unpaid = session.orders.filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID");

  await prisma.$transaction(async (tx) => {
    for (const o of unpaid) {
      const payment = await tx.payment.create({
        data: {
          orderId: o.id,
          method,
          status: "SUCCESSFUL",
          amount: o.total,
          currency: "NGN",
          reference: `${method}-${o.orderNumber}`,
          idempotencyKey: `${method.toLowerCase()}-${o.id}`,
        },
      });
      await tx.paymentEvent.create({
        data: { paymentId: payment.id, fromStatus: null, toStatus: "SUCCESSFUL", source: `staff:${staff.user.email}` },
      });
      if (o.status === "READY") {
        await tx.order.update({ where: { id: o.id }, data: { status: "COMPLETED", paymentStatus: "PAID" } });
        await tx.orderStatusHistory.create({
          data: { orderId: o.id, fromStatus: "READY", toStatus: "COMPLETED", note: "Table settled" },
        });
      } else {
        await tx.order.update({ where: { id: o.id }, data: { paymentStatus: "PAID" } });
      }
    }
    await tx.tableSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date(), closedById: staff.user.id },
    });
  });

  revalidatePath("/admin/tables");
  revalidatePath(`/admin/tables/${tableId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  redirect("/admin/tables");
}
