import { describe, it, expect } from "vitest";
import { AuthService, AuthError, type AccountRecord, type SessionRecord, type PasswordHasher } from "../src/auth/service";
import { hashToken, generateSessionToken } from "../src/auth/tokens";
import { argon2Hasher, ARGON2_PARAMS } from "../src/auth/argon2";

function memoryStores() {
  const accounts = new Map<string, AccountRecord>();
  const sessions = new Map<string, SessionRecord>();
  let n = 0;
  return {
    accounts: {
      async findByEmail(email: string) {
        return [...accounts.values()].find((a) => a.email === email) ?? null;
      },
      async create(d: { email: string; fullName: string; passwordHash: string; kind: "CUSTOMER" }) {
        const rec: AccountRecord = { id: `u${++n}`, email: d.email, fullName: d.fullName, passwordHash: d.passwordHash, status: "ACTIVE", kind: d.kind };
        accounts.set(rec.id, rec);
        return rec;
      },
      async touchLogin() {},
      _all: accounts,
    },
    sessions: {
      async create(d: { userId: string; tokenHash: string; expiresAt: Date }) {
        const rec: SessionRecord = { id: `s${++n}`, userId: d.userId, tokenHash: d.tokenHash, expiresAt: d.expiresAt, revokedAt: null };
        sessions.set(rec.id, rec);
        return rec;
      },
      async findByTokenHash(h: string) {
        return [...sessions.values()].find((s) => s.tokenHash === h) ?? null;
      },
      async revoke(id: string, at: Date) {
        const s = sessions.get(id);
        if (s) s.revokedAt = at;
      },
    },
  };
}

const fakeHasher: PasswordHasher = {
  async hash(p) { return `h:${p}`; },
  async verify(h, p) { return h === `h:${p}`; },
};

describe("tokens", () => {
  it("generates unique high-entropy tokens and hashes them deterministically", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toContain(a);
  });
});

describe("AuthService", () => {
  it("registers, then logs in, and resolves the session token", async () => {
    const stores = memoryStores();
    const auth = new AuthService({ hasher: fakeHasher, accounts: stores.accounts, sessions: stores.sessions });
    const reg = await auth.register({ fullName: "Ada Obi", email: "Ada@Example.com", password: "longenough1" });
    expect(reg.user.email).toBe("ada@example.com");
    const resolved = await auth.resolveSession(reg.token);
    expect(resolved?.userId).toBe(reg.user.id);

    const login = await auth.login({ email: "ada@example.com", password: "longenough1" });
    expect(login.token).not.toBe(reg.token);
  });

  it("rejects duplicate email, wrong password and unknown account with the same error for credentials", async () => {
    const stores = memoryStores();
    const auth = new AuthService({ hasher: fakeHasher, accounts: stores.accounts, sessions: stores.sessions });
    await auth.register({ fullName: "Ada Obi", email: "ada@example.com", password: "longenough1" });
    await expect(auth.register({ fullName: "X Y", email: "ada@example.com", password: "longenough1" }))
      .rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    await expect(auth.login({ email: "ada@example.com", password: "wrongpassword" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(auth.login({ email: "nobody@example.com", password: "wrongpassword" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("enforces password length and rejects invalid input", async () => {
    const stores = memoryStores();
    const auth = new AuthService({ hasher: fakeHasher, accounts: stores.accounts, sessions: stores.sessions });
    await expect(auth.register({ fullName: "Ada", email: "a@b.co", password: "short" }))
      .rejects.toBeInstanceOf(AuthError);
  });

  it("expires sessions and honours logout", async () => {
    const stores = memoryStores();
    let now = new Date("2026-01-01T00:00:00Z");
    const auth = new AuthService({
      hasher: fakeHasher, accounts: stores.accounts, sessions: stores.sessions,
      now: () => now, sessionTtlMs: 1000,
    });
    const reg = await auth.register({ fullName: "Ada Obi", email: "ada@example.com", password: "longenough1" });
    now = new Date(now.getTime() + 2000);
    expect(await auth.resolveSession(reg.token)).toBeNull();

    now = new Date("2026-01-01T00:00:00Z");
    const again = await auth.login({ email: "ada@example.com", password: "longenough1" });
    const sess = await auth.resolveSession(again.token);
    await auth.logout(sess!.sessionId);
    expect(await auth.resolveSession(again.token)).toBeNull();
  });

  it("refuses suspended accounts even with the right password", async () => {
    const stores = memoryStores();
    const auth = new AuthService({ hasher: fakeHasher, accounts: stores.accounts, sessions: stores.sessions });
    await auth.register({ fullName: "Ada Obi", email: "ada@example.com", password: "longenough1" });
    for (const a of stores.accounts._all.values()) a.status = "SUSPENDED";
    await expect(auth.login({ email: "ada@example.com", password: "longenough1" }))
      .rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });
});

describe("argon2id adapter", () => {
  it("uses the OWASP minimum Argon2id parameters and round-trips a password", async () => {
    expect(ARGON2_PARAMS.memoryCost).toBe(19456);
    const h = await argon2Hasher.hash("correct horse battery");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await argon2Hasher.verify(h, "correct horse battery")).toBe(true);
    expect(await argon2Hasher.verify(h, "wrong")).toBe(false);
  });
});
