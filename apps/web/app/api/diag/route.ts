// TEMPORARY diagnostic: database host, counts, admin row status (no secrets) and a hashing self-test. Remove after debugging.
import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { argon2Hasher } from "@restaurant/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  let host = "not set";
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    host = `${u.host}${u.pathname}`;
  } catch {
    host = "not set or invalid";
  }

  let hashSelfTest: string;
  try {
    const h = await argon2Hasher.hash("self-test-password");
    const ok = await argon2Hasher.verify(h, "self-test-password");
    const bad = await argon2Hasher.verify(h, "wrong-password");
    hashSelfTest = ok && !bad ? "pass" : `fail (correct=${ok}, wrong=${bad})`;
  } catch (e) {
    hashSelfTest = `throws: ${e instanceof Error ? e.message : "unknown"}`;
  }

  try {
    const [staff, categories, products, admin] = await Promise.all([
      prisma.user.count({ where: { kind: "STAFF" } }),
      prisma.category.count(),
      prisma.product.count(),
      prisma.user.findFirst({
        where: { email: "karambaaleeyu@gmail.com" },
        select: { kind: true, status: true, deletedAt: true, passwordHash: true, roles: { select: { role: { select: { key: true } } } } },
      }),
    ]);
    const hashParams = admin?.passwordHash ? admin.passwordHash.split("$").slice(1, 4).join("$") : null;
    return NextResponse.json({
      host,
      staff,
      categories,
      products,
      adminFound: !!admin,
      adminKind: admin?.kind ?? null,
      adminStatus: admin?.status ?? null,
      adminDeleted: admin?.deletedAt != null,
      adminRoles: admin?.roles.map((r) => r.role.key) ?? [],
      adminHashFormat: hashParams,
      hashSelfTest,
    });
  } catch (e) {
    return NextResponse.json({ host, hashSelfTest, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
