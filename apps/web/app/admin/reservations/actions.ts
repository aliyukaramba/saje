"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";

const NEXT: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SEATED", "NO_SHOW", "CANCELLED"],
  SEATED: ["COMPLETED"],
};

function fail(message: string): never {
  redirect(`/admin/reservations?error=${encodeURIComponent(message)}`);
}

function done(): never {
  revalidatePath("/admin/reservations");
  redirect("/admin/reservations");
}

export async function setReservationStatus(formData: FormData) {
  const staff = await staffWith("reservations:manage");
  if (!staff) redirect("/admin/login");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) fail("Reservation not found");
  if (!(NEXT[r.status] ?? []).includes(to)) fail(`Cannot change a ${r.status.toLowerCase()} reservation to ${to.toLowerCase()}`);
  await prisma.reservation.update({ where: { id }, data: { status: to as "CONFIRMED" | "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" } });
  done();
}

export async function setTableCapacity(formData: FormData) {
  const staff = await staffWith("reservations:manage");
  if (!staff) redirect("/admin/login");
  const id = String(formData.get("tableId") ?? "");
  const capacity = Number(formData.get("capacity"));
  if (!id || !Number.isInteger(capacity) || capacity < 1 || capacity > 30) fail("Seats must be a whole number from 1 to 30");
  await prisma.diningTable.update({ where: { id }, data: { capacity } });
  done();
}
