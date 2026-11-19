"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, createPosOrder, OrderInputError } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { parseMajorToMinor, formatMinor, type Minor } from "@restaurant/shared";

function fail(message: string): never {
  redirect(`/admin/pos?error=${encodeURIComponent(message)}`);
}

const linesSchema = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(99),
    variantId: z.string().max(64).optional(),
    modifierIds: z.array(z.string().max(64)).max(20).default([]),
  })).min(1).max(50),
});

export async function chargePosOrder(formData: FormData) {
  const staff = await staffWith("pos:sell");
  if (!staff) redirect("/admin/login");

  let lines;
  try {
    lines = linesSchema.parse({ lines: JSON.parse(String(formData.get("lines") ?? "[]")) }).lines;
  } catch {
    fail("Choose at least one item");
  }
  const customerName = String(formData.get("customerName") ?? "").trim().slice(0, 120) || null;

  const methodRaw = String(formData.get("paymentMethod") ?? "CASH");
  if (!(["CASH", "POS_TERMINAL", "BANK_TRANSFER"] as string[]).includes(methodRaw)) fail("Choose how the customer paid");
  const paymentMethod = methodRaw as "CASH" | "POS_TERMINAL" | "BANK_TRANSFER";

  // Optional, cash only: the cash the customer handed over, in naira. Blank means no change calculation.
  let cashTendered: Minor | null = null;
  const cashRaw = String(formData.get("cashReceived") ?? "").replace(/,/g, "").trim();
  if (paymentMethod === "CASH" && cashRaw) {
    try {
      cashTendered = parseMajorToMinor(cashRaw);
    } catch {
      fail("Enter the cash received as a number, for example 5000");
    }
    if (cashTendered <= 0n) fail("Enter the cash received as a number, for example 5000");
  }

  let result;
  try {
    result = await createPosOrder(prisma, {
      lines,
      customerName,
      staffEmail: staff.user.email,
      now: new Date(),
      cashTendered,
      method: paymentMethod,
    });
  } catch (e) {
    if (e instanceof OrderInputError) fail(e.message);
    console.error("pos sale failed", e);
    fail("The sale could not be saved. Please try again.");
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  const changeParam = result.change !== null ? `&change=${encodeURIComponent(formatMinor(result.change as Minor))}` : "";
  redirect(`/admin/pos?done=${encodeURIComponent(result.orderNumber)}${changeParam}`);
}
