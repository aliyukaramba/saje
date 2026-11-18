import { Prisma, type PrismaClient } from "@prisma/client";
import { AuthError, type AccountRecord, type AccountStore, type SessionRecord, type SessionStore } from "@restaurant/shared";

export function createAccountStore(db: PrismaClient): AccountStore {
  return {
    async findByEmail(email) {
      const u = await db.user.findFirst({ where: { email, deletedAt: null } });
      return u ? toAccount(u) : null;
    },
    async create(data) {
      try {
        const u = await db.user.create({
          data: { email: data.email, fullName: data.fullName, passwordHash: data.passwordHash, kind: data.kind },
        });
        return toAccount(u);
      } catch (e) {
        // Unique constraint on email: another request registered the same address first.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AuthError("EMAIL_TAKEN");
        throw e;
      }
    },
    async touchLogin(id, at) {
      await db.user.update({ where: { id }, data: { lastLoginAt: at } });
    },
  };
}

export function createSessionStore(db: PrismaClient): SessionStore {
  return {
    async create(data) {
      const s = await db.session.create({
        data: { userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt, userAgent: data.userAgent ?? null },
      });
      return toSession(s);
    },
    async findByTokenHash(tokenHash) {
      const s = await db.session.findUnique({ where: { tokenHash } });
      return s ? toSession(s) : null;
    },
    async revoke(id, at) {
      await db.session.update({ where: { id }, data: { revokedAt: at } });
    },
  };
}

type UserRow = { id: string; email: string | null; fullName: string; passwordHash: string | null; status: "ACTIVE" | "SUSPENDED"; kind: "STAFF" | "CUSTOMER" | "GUEST" };
function toAccount(u: UserRow): AccountRecord {
  return { id: u.id, email: u.email, fullName: u.fullName, passwordHash: u.passwordHash, status: u.status, kind: u.kind };
}

type SessionRow = { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null };
function toSession(s: SessionRow): SessionRecord {
  return { id: s.id, userId: s.userId, tokenHash: s.tokenHash, expiresAt: s.expiresAt, revokedAt: s.revokedAt };
}
