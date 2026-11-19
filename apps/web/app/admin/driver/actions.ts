"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";

function fail(message: string): never {
  redirect(`/admin/driver?error=${encodeURIComponent(message)}`);
}

async function loadMine(assignmentId: string, staffId: string) {
  const a = await prisma.deliveryAssignment.findUnique({ where: { id: assignmentId }, include: { order: true } });
  if (!a || a.staffId !== staffId) fail("This delivery is not assigned to you");
  return a;
}

function refresh() {
  revalidatePath("/admin/driver");
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  redirect("/admin/driver");
}

export async function markPickedUp(formData: FormData) {
  const staff = await staffWith("delivery:update_own");
  if (!staff) redirect("/admin/login");
  const a = await loadMine(String(formData.get("assignmentId") ?? ""), staff.user.id);
  if (a.status !== "ASSIGNED") fail("This delivery is already picked up or closed");
  if (a.order.status !== "READY") fail("The kitchen has not finished this order yet");

  const updated = await prisma.order.updateMany({
    where: { id: a.orderId, version: a.order.version, status: "READY" },
    data: { status: "OUT_FOR_DELIVERY", version: { increment: 1 } },
  });
  if (updated.count === 0) fail("This order changed. Refresh and try again.");
  await prisma.$transaction([
    prisma.deliveryAssignment.update({ where: { id: a.id }, data: { status: "PICKED_UP", pickedUpAt: new Date() } }),
    prisma.orderStatusHistory.create({
      data: { orderId: a.orderId, fromStatus: "READY", toStatus: "OUT_FOR_DELIVERY", note: `Picked up by ${staff.user.email}` },
    }),
  ]);
  refresh();
}

export async function markDelivered(formData: FormData) {
  const staff = await staffWith("delivery:update_own");
  if (!staff) redirect("/admin/login");
  const a = await loadMine(String(formData.get("assignmentId") ?? ""), staff.user.id);
  if (a.status !== "PICKED_UP") fail("Pick the order up before marking it delivered");
  if (a.order.paymentStatus !== "PAID") fail("Payment is not confirmed for this order, so it cannot be closed");

  const now = new Date();
  const updated = await prisma.order.updateMany({
    where: { id: a.orderId, version: a.order.version, status: "OUT_FOR_DELIVERY" },
    data: { status: "COMPLETED", completedAt: now, version: { increment: 1 } },
  });
  if (updated.count === 0) fail("This order changed. Refresh and try again.");
  await prisma.$transaction([
    prisma.deliveryAssignment.update({ where: { id: a.id }, data: { status: "DELIVERED", deliveredAt: now } }),
    prisma.orderStatusHistory.create({
      data: { orderId: a.orderId, fromStatus: "OUT_FOR_DELIVERY", toStatus: "COMPLETED", note: `Delivered by ${staff.user.email}` },
    }),
  ]);
  refresh();
}

/** Records a failed delivery. The order stays open so the manager can reassign or cancel it. */
export async function markFailed(formData: FormData) {
  const staff = await staffWith("delivery:update_own");
  if (!staff) redirect("/admin/login");
  const parsed = z.object({
    assignmentId: z.string().min(1),
    reason: z.string().trim().min(3).max(200),
  }).safeParse({ assignmentId: formData.get("assignmentId"), reason: formData.get("reason") });
  if (!parsed.success) fail("Say why the delivery failed");
  const a = await loadMine(parsed.data.assignmentId, staff.user.id);
  if (a.status === "DELIVERED" || a.status === "FAILED") fail("This delivery is already closed");
  await prisma.deliveryAssignment.update({
    where: { id: a.id },
    data: { status: "FAILED", failureReason: parsed.data.reason },
  });
  refresh();
}
