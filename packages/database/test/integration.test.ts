import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

// Runs only when DATABASE_URL points at a database with migrations applied.
// Uses a unique email per run and cleans up after itself.
const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("database integration (Neon dev branch)", () => {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  let userId: string | null = null;
  // Loaded lazily so the test file can be collected even when the Prisma client is not generated.
  let prisma: PrismaClient;
  let AuthService: typeof import("@restaurant/shared").AuthService;
  let argon2Hasher: typeof import("@restaurant/shared").argon2Hasher;
  let createAccountStore: typeof import("../src/stores/auth").createAccountStore;
  let createSessionStore: typeof import("../src/stores/auth").createSessionStore;

  beforeAll(async () => {
    ({ prisma } = await import("../src/client"));
    ({ createAccountStore, createSessionStore } = await import("../src/stores/auth"));
    ({ AuthService, argon2Hasher } = await import("@restaurant/shared"));
    await prisma.$connect();
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("registers, logs in and resolves a session through the real stores", async () => {
    const auth = new AuthService({
      hasher: argon2Hasher,
      accounts: createAccountStore(prisma),
      sessions: createSessionStore(prisma),
    });
    const reg = await auth.register({ fullName: "Test User", email, password: "a-long-password-1" });
    userId = reg.user.id;
    expect((await auth.resolveSession(reg.token))?.userId).toBe(reg.user.id);
    const login = await auth.login({ email, password: "a-long-password-1" });
    expect(login.user.id).toBe(reg.user.id);
  });

  it("rejects a second registration with the same email", async () => {
    const auth = new AuthService({ hasher: argon2Hasher, accounts: createAccountStore(prisma), sessions: createSessionStore(prisma) });
    await expect(auth.register({ fullName: "Dup", email, password: "a-long-password-1" }))
      .rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("database rejects overlapping reservations on one table (migration constraint)", async () => {
    const area = await prisma.diningArea.upsert({ where: { name: "Test area" }, update: {}, create: { name: "Test area" } });
    const table = await prisma.diningTable.upsert({
      where: { number: "TEST-1" }, update: {}, create: { number: "TEST-1", areaId: area.id },
    });
    const start = new Date("2030-01-01T18:00:00Z");
    const end = new Date("2030-01-01T20:00:00Z");
    const first = await prisma.reservation.create({
      data: { guestName: "A", guestPhone: "0800", partySize: 2, startsAt: start, endsAt: end, status: "CONFIRMED", tableId: table.id },
    });
    await expect(prisma.reservation.create({
      data: { guestName: "B", guestPhone: "0801", partySize: 2, startsAt: new Date("2030-01-01T19:00:00Z"), endsAt: new Date("2030-01-01T21:00:00Z"), status: "CONFIRMED", tableId: table.id },
    })).rejects.toThrow();
    await prisma.reservation.delete({ where: { id: first.id } });
  });
});
