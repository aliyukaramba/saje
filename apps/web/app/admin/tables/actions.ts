"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@restaurant/database";
import { generateQrToken, hashQrToken } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { QR_ONCE_COOKIE } from "../../../lib/qr-cookie";

function fail(message: string): never {
  redirect(`/admin/tables?error=${encodeURIComponent(message)}`);
}

async function requireTables() {
  const staff = await staffWith("tables:manage");
  if (!staff) redirect("/admin/login");
}

export async function createTable(formData: FormData) {
  await requireTables();
  const parsed = z.object({
    number: z.string().trim().min(1).max(20),
    name: z.string().trim().max(60).optional(),
  }).safeParse({ number: formData.get("number"), name: formData.get("name") || undefined });
  if (!parsed.success) fail("Enter a table number");
  const exists = await prisma.diningTable.findUnique({ where: { number: parsed.data.number } });
  if (exists) fail("A table with this number already exists");
  let area = await prisma.diningArea.findFirst({ where: { isActive: true } });
  area ??= await prisma.diningArea.create({ data: { name: "Dining room" } });
  await prisma.diningTable.create({
    data: { number: parsed.data.number, name: parsed.data.name ?? null, areaId: area.id },
  });
  revalidatePath("/admin/tables");
  redirect("/admin/tables");
}

/** Issues a new table link. The raw token is shown once; only its hash is stored. Old links are revoked. */
export async function issueTableLink(formData: FormData) {
  await requireTables();
  const tableId = String(formData.get("tableId") ?? "");
  const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
  if (!table) fail("Table not found");
  const token = generateQrToken();
  await prisma.$transaction([
    prisma.qrToken.updateMany({ where: { tableId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } }),
    prisma.qrToken.create({ data: { tableId, tokenHash: hashQrToken(token) } }),
  ]);
  const jar = await cookies();
  jar.set(QR_ONCE_COOKIE, JSON.stringify({ number: table.number, token }), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/admin/tables",
    maxAge: 600,
  });
  redirect("/admin/tables");
}

export async function dismissTableLink() {
  await requireTables();
  const jar = await cookies();
  jar.delete({ name: QR_ONCE_COOKIE, path: "/admin/tables" });
  redirect("/admin/tables");
}
