"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, minorToDecimal } from "@restaurant/database";
import { parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";

const UNITS = ["g", "ml", "piece"] as const;

function fail(message: string): never {
  redirect(`/admin/inventory?error=${encodeURIComponent(message)}`);
}

async function requireInventory() {
  const staff = await staffWith("inventory:manage");
  if (!staff) redirect("/admin/login");
  return staff;
}

function done(): never {
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}

function positiveNumber(value: FormDataEntryValue | null, label: string, allowZero = false): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) fail(`${label} must be a number${allowZero ? "" : " above zero"}`);
  return n;
}

export async function createInventoryItem(formData: FormData) {
  await requireInventory();
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    unit: z.enum(UNITS),
  }).safeParse({ name: formData.get("name"), unit: formData.get("unit") });
  if (!parsed.success) fail("Enter a name and choose a unit");
  const reorder = positiveNumber(formData.get("reorderLevel") || "0", "Reorder level", true);
  let cost;
  try {
    cost = parseMajorToMinor(String(formData.get("cost") || "0"));
  } catch {
    fail("Enter the cost in naira, for example 850");
  }
  const exists = await prisma.inventoryItem.findUnique({ where: { name: parsed.data.name } });
  if (exists) fail("An item with this name already exists");
  await prisma.inventoryItem.create({
    data: {
      name: parsed.data.name,
      unit: parsed.data.unit,
      reorderLevel: reorder,
      costPerUnit: minorToDecimal(cost),
    },
  });
  done();
}

/** Adds stock received from a supplier. */
export async function restockItem(formData: FormData) {
  const staff = await requireInventory();
  const id = String(formData.get("itemId") ?? "");
  const qty = positiveNumber(formData.get("quantity"), "Quantity");
  if (!id) fail("Choose an item");
  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id }, data: { quantityOnHand: { increment: qty } } }),
    prisma.stockMovement.create({
      data: { inventoryItemId: id, type: "PURCHASE", quantity: qty, actorId: staff.user.id, note: "Stock received" },
    }),
  ]);
  done();
}

/** Sets the counted quantity. The difference is recorded as an adjustment. */
export async function recordCount(formData: FormData) {
  const staff = await requireInventory();
  const id = String(formData.get("itemId") ?? "");
  const counted = positiveNumber(formData.get("counted"), "Counted quantity", true);
  if (!id) fail("Choose an item");
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) fail("Item not found");
  const delta = counted - Number(item.quantityOnHand.toString());
  if (delta === 0) done();
  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id }, data: { quantityOnHand: counted } }),
    prisma.stockMovement.create({
      data: { inventoryItemId: id, type: "ADJUSTMENT", quantity: delta, actorId: staff.user.id, note: "Stock count" },
    }),
  ]);
  done();
}

/** Adds an ingredient to a dish's recipe. Quantities are whole units: grams, millilitres or pieces per portion. */
export async function addRecipeLine(formData: FormData) {
  await requireInventory();
  const productId = String(formData.get("productId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const qty = positiveNumber(formData.get("quantity"), "Quantity");
  if (!productId || !itemId) fail("Choose a dish and an ingredient");
  if (!Number.isInteger(qty)) fail("Use whole units: grams, millilitres or pieces per portion");
  const recipe = await prisma.recipe.upsert({
    where: { productId },
    create: { productId },
    update: {},
  });
  await prisma.recipeIngredient.upsert({
    where: { recipeId_inventoryItemId: { recipeId: recipe.id, inventoryItemId: itemId } },
    create: { recipeId: recipe.id, inventoryItemId: itemId, quantity: qty },
    update: { quantity: qty },
  });
  done();
}
