"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, minorToDecimal } from "@restaurant/database";
import { parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { storeMenuImage } from "../../../lib/media";

function slugify(input: string): string {
  const base = input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function requireMenuAccess() {
  const staff = await staffWith("menu:manage");
  if (!staff) redirect("/admin/login");
}

function fail(message: string): never {
  redirect(`/admin/menu?error=${encodeURIComponent(message)}`);
}

export async function createCategory(formData: FormData) {
  await requireMenuAccess();
  const parsed = z.object({ name: z.string().trim().min(2).max(60) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) fail("Category name must be 2 to 60 characters");
  await prisma.category.create({ data: { name: parsed.data.name, slug: slugify(parsed.data.name) } });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  redirect("/admin/menu");
}

export async function createProduct(formData: FormData) {
  await requireMenuAccess();
  const parsed = z.object({
    categoryId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    price: z.string().min(1),
  }).safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
  });
  if (!parsed.success) fail("Check the dish name, category and price");
  let price;
  try {
    price = parseMajorToMinor(parsed.data.price);
  } catch {
    fail("Enter the price in naira, for example 4500 or 4500.50");
  }
  if (price <= 0n) fail("Price must be greater than zero");
  await prisma.product.create({
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description || null,
      basePrice: minorToDecimal(price),
      isAvailable: true,
    },
  });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  redirect("/admin/menu");
}

export async function updateProductAvailability(formData: FormData) {
  await requireMenuAccess();
  const id = String(formData.get("id") ?? "");
  const available = formData.get("available") === "true";
  if (!id) fail("Missing dish");
  await prisma.product.update({ where: { id }, data: { isAvailable: !available } });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  redirect("/admin/menu");
}

export async function deleteProduct(formData: FormData) {
  await requireMenuAccess();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("Missing dish");
  // Soft delete keeps past order items intact.
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isAvailable: false } });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  redirect("/admin/menu");
}

export async function uploadProductImage(formData: FormData) {
  await requireMenuAccess();
  const id = String(formData.get("productId") ?? "");
  const file = formData.get("image");
  if (!id) fail("Missing dish");
  if (!(file instanceof File) || file.size === 0) fail("Choose a photo to upload");
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) fail("Dish not found");
  let url: string;
  try {
    url = await storeMenuImage(id, file);
  } catch (e) {
    fail(e instanceof Error ? e.message : "The photo could not be uploaded");
  }
  await prisma.product.update({ where: { id }, data: { imageUrl: url } });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  revalidatePath("/");
  redirect("/admin/menu");
}

export async function updateProduct(formData: FormData) {
  await requireMenuAccess();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!id) fail("Missing dish");
  if (name.length < 2 || name.length > 120) fail("Dish name must be 2 to 120 characters");
  if (!categoryId) fail("Choose a category");

  let price: bigint;
  try {
    price = parseMajorToMinor(String(formData.get("price") ?? "").replace(/,/g, "").trim());
  } catch {
    fail("Enter the price in naira, for example 4500");
  }
  if (price <= 0n) fail("Price must be greater than zero");

  const discountRaw = String(formData.get("discountPrice") ?? "").replace(/,/g, "").trim();
  let discount: bigint | null = null;
  if (discountRaw) {
    try {
      discount = parseMajorToMinor(discountRaw);
    } catch {
      fail("Enter the discount price in naira, or leave it empty");
    }
    if (discount <= 0n || discount >= price) fail("The discount price must be lower than the price");
  }

  await prisma.product.update({
    where: { id },
    data: {
      name,
      description: description || null,
      categoryId,
      basePrice: minorToDecimal(price),
      discountPrice: discount !== null ? minorToDecimal(discount) : null,
    },
  });
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  redirect("/admin/menu");
}
