// Server-side auth for the website and admin area. Session tokens live in an httpOnly cookie.
import { cookies } from "next/headers";
import { prisma, createAccountStore, createSessionStore } from "@restaurant/database";
import { AuthService, argon2Hasher } from "@restaurant/shared";

export const SESSION_COOKIE = "saje_session";

export function getAuthService(): AuthService {
  return new AuthService({
    hasher: argon2Hasher,
    accounts: createAccountStore(prisma),
    sessions: createSessionStore(prisma),
  });
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function currentStaff() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const resolved = await getAuthService().resolveSession(token);
  if (!resolved) return null;
  const user = await prisma.user.findUnique({
    where: { id: resolved.userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.kind !== "STAFF" || user.status !== "ACTIVE" || user.deletedAt) return null;
  return {
    sessionId: resolved.sessionId,
    user: { id: user.id, fullName: user.fullName, email: user.email },
    roles: user.roles.map((r) => r.role.name),
  };
}
