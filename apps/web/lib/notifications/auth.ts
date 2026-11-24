import { cookies } from "next/headers";
import { prisma } from "@restaurant/database";
import { getAuthService, SESSION_COOKIE } from "../auth";

export async function notificationUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const jar = await cookies();
  const token = bearer || jar.get(SESSION_COOKIE)?.value || "";
  if (!token) return null;
  const session = await getAuthService().resolveSession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, kind: true, status: true, deletedAt: true },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;
  return user;
}
