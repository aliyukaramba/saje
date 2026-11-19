"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, minorToDecimal } from "@restaurant/database";
import { parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";

function fail(message: string): never {
  redirect(`/admin/delivery?error=${encodeURIComponent(message)}`);
}

async function requireSettings() {
  const staff = await staffWith("settings:manage");
  if (!staff) redirect("/admin/login");
}

function done(): never {
  revalidatePath("/admin/delivery");
  revalidatePath("/cart");
  redirect("/admin/delivery");
}

export async function setFulfilmentSwitches(formData: FormData) {
  await requireSettings();
  await prisma.restaurantSettings.update({
    where: { id: "singleton" },
    data: {
      pickupEnabled: formData.get("pickupEnabled") === "on",
      deliveryEnabled: formData.get("deliveryEnabled") === "on",
    },
  });
  done();
}

export async function createDeliveryZone(formData: FormData) {
  await requireSettings();
  const parsed = z.object({
    name: z.string().trim().min(2).max(60),
    fee: z.string().min(1),
    minOrderAmount: z.string().min(1),
  }).safeParse({
    name: formData.get("name"),
    fee: formData.get("fee"),
    minOrderAmount: formData.get("minOrderAmount"),
  });
  if (!parsed.success) fail("Check the zone name, fee and minimum order");
  let fee;
  let minOrder;
  try {
    fee = parseMajorToMinor(parsed.data.fee);
    minOrder = parseMajorToMinor(parsed.data.minOrderAmount);
  } catch {
    fail("Enter amounts in naira, for example 1500 or 1500.50");
  }
  if (fee < 0n || minOrder < 0n) fail("Amounts cannot be negative");
  const exists = await prisma.deliveryZone.findUnique({ where: { name: parsed.data.name } });
  if (exists) fail("A zone with this name already exists");
  await prisma.deliveryZone.create({
    data: { name: parsed.data.name, fee: minorToDecimal(fee), minOrderAmount: minorToDecimal(minOrder), isActive: true },
  });
  done();
}

export async function toggleDeliveryZone(formData: FormData) {
  await requireSettings();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) fail("Missing zone");
  await prisma.deliveryZone.update({ where: { id }, data: { isActive: !active } });
  done();
}
