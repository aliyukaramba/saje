"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";

function fail(message: string): never {
  redirect(`/admin/dispatch?error=${encodeURIComponent(message)}`);
}

/** Assigns a delivery order to an active driver. Reassigning replaces the previous driver. */
export async function assignDriver(formData: FormData) {
  const staff = await staffWith("delivery:assign");
  if (!staff) redirect("/admin/login");
  const orderId = String(formData.get("orderId") ?? "");
  const driverId = String(formData.get("driverId") ?? "");
  if (!orderId || !driverId) fail("Choose a driver");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.type !== "DELIVERY") fail("Delivery order not found");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") fail("This order is already closed");

  const driver = await prisma.user.findFirst({
    where: {
      id: driverId,
      kind: "STAFF",
      status: "ACTIVE",
      deletedAt: null,
      roles: { some: { role: { key: "delivery_staff" } } },
    },
  });
  if (!driver) fail("Choose an active delivery driver");

  const now = new Date();
  await prisma.deliveryAssignment.upsert({
    where: { orderId },
    create: { orderId, staffId: driverId, status: "ASSIGNED", assignedAt: now },
    update: { staffId: driverId, status: "ASSIGNED", assignedAt: now, pickedUpAt: null, failureReason: null },
  });
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/driver");
  redirect("/admin/dispatch");
}
