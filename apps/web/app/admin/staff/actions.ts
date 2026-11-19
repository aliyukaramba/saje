"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@restaurant/database";
import { ROLE_KEYS, passwordHasher, type RoleKey } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";

function fail(message: string): never {
  redirect(`/admin/staff?error=${encodeURIComponent(message)}`);
}

async function requireStaffManager() {
  const staff = await staffWith("staff:manage");
  if (!staff) redirect("/admin/login");
  return staff;
}

/** Creates a staff account with a starting password. Only super admins can grant the super admin role. */
export async function createStaff(formData: FormData) {
  const actor = await requireStaffManager();
  const roles = formData.getAll("roles").map(String);
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    fullName: z.string().trim().min(2).max(120),
    password: z.string().min(10).max(128),
  }).safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) fail("Check the name, email and a password of at least 10 characters");
  if (roles.length === 0 || roles.some((r) => !ROLE_KEYS.includes(r as RoleKey))) fail("Choose at least one valid role");
  if (roles.includes("super_admin") && !actor.roleKeys.includes("super_admin")) fail("Only a super admin can grant the super admin role");

  const existing = await prisma.user.findFirst({ where: { email: parsed.data.email } });
  if (existing) fail("An account with this email already exists");

  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } } });
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      kind: "STAFF",
      status: "ACTIVE",
      passwordHash: await passwordHasher.hash(parsed.data.password),
    },
  });
  await prisma.userRole.createMany({ data: roleRows.map((r) => ({ userId: user.id, roleId: r.id })) });
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

/** Replaces a staff member's roles. Sessions are kept, so their new permissions apply on the next request. */
export async function updateStaffRoles(formData: FormData) {
  const actor = await requireStaffManager();
  const userId = String(formData.get("userId") ?? "");
  const roles = formData.getAll("roles").map(String).filter((r) => ROLE_KEYS.includes(r as RoleKey));
  if (!userId) fail("Missing staff member");
  if (roles.length === 0) fail("Choose at least one role");
  if (roles.includes("super_admin") && !actor.roleKeys.includes("super_admin")) fail("Only a super admin can grant the super admin role");
  if (userId === actor.user.id && !roles.includes("super_admin")) fail("You cannot remove your own super admin role");

  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } } });
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: roleRows.map((r) => ({ userId, roleId: r.id })) }),
  ]);
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

/** Suspends a staff account and signs them out everywhere. */
export async function suspendStaff(formData: FormData) {
  const actor = await requireStaffManager();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) fail("Missing staff member");
  if (userId === actor.user.id) fail("You cannot suspend your own account");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function reactivateStaff(formData: FormData) {
  await requireStaffManager();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) fail("Missing staff member");
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}
