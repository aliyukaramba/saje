import { prisma } from "@restaurant/database";
import { canAny, type Permission, type RoleKey } from "@restaurant/shared";
import { getAuthService } from "./auth";

export async function requestStaff(request: Request, permission?: Permission) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = await getAuthService().resolveSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.kind !== "STAFF" || user.status !== "ACTIVE" || user.deletedAt) return null;

  const roles = user.roles.map((item) => item.role.key) as RoleKey[];
  if (permission && !canAny(roles, permission)) return null;

  return {
    sessionId: session.sessionId,
    user: { id: user.id, fullName: user.fullName, email: user.email },
    roles,
    permissions: [...new Set(user.roles.flatMap((item) => item.role.permissions.map((p) => p.permission.key)))],
  };
}
