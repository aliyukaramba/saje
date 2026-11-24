"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, deductForOrder } from "@restaurant/database";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { notifyOrderStatusChange } from "../../../lib/notifications/service";

function fail(message: string): never {
  redirect(`/admin/orders?error=${encodeURIComponent(message)}`);
}

/**
 * Moves an order to the next status. Enforces the status flow, a permission check, and
 * optimistic concurrency (two staff members cannot overwrite each other's change).
 * CONFIRMED is never set by hand: only a verified payment confirms an order.
 */
export async function advanceOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as OrderStatus;
  const staff = await staffWith("orders:update_status");
  if (!staff) redirect("/admin/login");
  if (!id || !ORDER_STATUSES.includes(to)) fail("Invalid request");
  if (to === "CONFIRMED") fail("Orders are confirmed automatically when payment is verified");
  if (to === "CANCELLED" && !(await staffWith("orders:cancel"))) fail("You cannot cancel orders");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) fail("Order not found");
  if (!canTransition(order.status, to)) fail(`Cannot move from ${order.status} to ${to}`);

  const updated = await prisma.order.updateMany({
    where: { id, version: order.version },
    data: { status: to, version: { increment: 1 } },
  });
  if (updated.count === 0) fail("This order was just changed by someone else. Refresh and try again.");

  await prisma.orderStatusHistory.create({
    data: { orderId: id, fromStatus: order.status, toStatus: to, note: `Set by ${staff.user.email}` },
  });
  // Kitchen accepted the order: take the recipe ingredients from stock (idempotent).
  if (to === "ACCEPTED") await deductForOrder(prisma, id);
  try { await notifyOrderStatusChange(id, order.status, to); }
  catch (error) { console.error("SAJE order notification dispatch failed", error); }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  revalidatePath("/admin/inventory");
  redirect(new URL(String(formData.get("back") ?? "/admin/orders"), "http://x").pathname);
}
