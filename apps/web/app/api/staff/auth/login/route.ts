import { NextResponse } from "next/server";
import { AuthError } from "@restaurant/shared";
import { getAuthService } from "../../../../../lib/auth";
import { prisma } from "@restaurant/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Enter your staff email and password." }, { status: 400 });
  }

  const auth = getAuthService();
  try {
    const result = await auth.login(
      { email: body.email, password: body.password },
      request.headers.get("user-agent") ?? undefined,
    );
    const revokeNewSession = async () => {
      const session = await auth.resolveSession(result.token);
      if (session) await auth.logout(session.sessionId);
    };

    if (result.user.kind !== "STAFF") {
      await revokeNewSession();
      return NextResponse.json({ error: "This account does not have staff access." }, { status: 403 });
    }

    const staff = await prisma.user.findUnique({
      where: { id: result.user.id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    });
    if (!staff || staff.status !== "ACTIVE" || staff.deletedAt || staff.roles.length === 0) {
      await revokeNewSession();
      return NextResponse.json({ error: "Your staff account is not active. Contact a manager." }, { status: 403 });
    }

    return NextResponse.json({
      token: result.token,
      user: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        roles: staff.roles.map((item) => item.role.key),
        permissions: [...new Set(staff.roles.flatMap((item) => item.role.permissions.map((p) => p.permission.key)))],
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const message = error.code === "ACCOUNT_SUSPENDED"
        ? "This staff account is suspended. Contact a manager."
        : "Email or password is incorrect.";
      return NextResponse.json({ error: message }, { status: error.code === "ACCOUNT_SUSPENDED" ? 403 : 401 });
    }
    console.error("staff mobile login failed", error);
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
