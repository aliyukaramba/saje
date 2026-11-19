"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, createPosOrder, OrderInputError } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";

function fail(message: string): never {
  redirect(`/admin/pos?error=${encodeURIComponent(message)}`);
}

const linesSchema = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(99),
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

  let result;
  try {
    result = await createPosOrder(prisma, {
      lines: lines.map((l) => ({ ...l, modifierIds: [] })),
      customerName,
      staffEmail: staff.user.email,
      now: new Date(),
    });
  } catch (e) {
    if (e instanceof OrderInputError) fail(e.message);
    console.error("pos sale failed", e);
    fail("The sale could not be saved. Please try again.");
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  redirect(`/admin/pos?done=${encodeURIComponent(result.orderNumber)}`);
}
