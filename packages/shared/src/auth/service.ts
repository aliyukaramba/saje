import { generateSessionToken, hashToken } from "./tokens";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "./schemas";

// Ports: the service depends on these interfaces, not on Prisma, argon2 or a clock.
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccountRecord {
  id: string;
  email: string | null;
  fullName: string;
  passwordHash: string | null;
  status: "ACTIVE" | "SUSPENDED";
  kind: "STAFF" | "CUSTOMER" | "GUEST";
}

export interface AccountStore {
  findByEmail(email: string): Promise<AccountRecord | null>;
  create(data: { email: string; fullName: string; passwordHash: string; kind: "CUSTOMER" }): Promise<AccountRecord>;
  touchLogin(id: string, at: Date): Promise<void>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionStore {
  create(data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string }): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revoke(id: string, at: Date): Promise<void>;
}

export class AuthError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "ACCOUNT_SUSPENDED" | "VALIDATION") {
    super(code);
    this.name = "AuthError";
  }
}

// Constant-cost dummy hash so unknown emails take as long as wrong passwords.
const DUMMY_HASH_PLACEHOLDER = "dummy";

export interface AuthDeps {
  hasher: PasswordHasher;
  accounts: AccountStore;
  sessions: SessionStore;
  now?: () => Date;
  sessionTtlMs?: number;
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthService {
  private readonly now: () => Date;
  private readonly ttl: number;
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: AuthDeps) {
    this.now = deps.now ?? (() => new Date());
    this.ttl = deps.sessionTtlMs ?? DEFAULT_TTL_MS;
  }

  async register(input: unknown, userAgent?: string) {
    const parsed = parseOrThrow(registerSchema, input);
    const existing = await this.deps.accounts.findByEmail(parsed.email);
    if (existing) throw new AuthError("EMAIL_TAKEN");
    const passwordHash = await this.deps.hasher.hash(parsed.password);
    const account = await this.deps.accounts.create({
      email: parsed.email,
      fullName: parsed.fullName,
      passwordHash,
      kind: "CUSTOMER",
    });
    return this.openSession(account, userAgent);
  }

  async login(input: unknown, userAgent?: string) {
    const parsed = parseOrThrow(loginSchema, input) as LoginInput;
    const account = await this.deps.accounts.findByEmail(parsed.email);
    if (!account || !account.passwordHash) {
      // Spend comparable time on unknown accounts to limit user enumeration.
      await this.deps.hasher.verify(await this.getDummyHash(), parsed.password);
      throw new AuthError("INVALID_CREDENTIALS");
    }
    const ok = await this.deps.hasher.verify(account.passwordHash, parsed.password);
    if (!ok) throw new AuthError("INVALID_CREDENTIALS");
    if (account.status !== "ACTIVE") throw new AuthError("ACCOUNT_SUSPENDED");
    await this.deps.accounts.touchLogin(account.id, this.now());
    return this.openSession(account, userAgent);
  }

  /** Returns the account for a raw token, or null if missing, expired or revoked. */
  async resolveSession(rawToken: string | undefined | null) {
    if (!rawToken) return null;
    const session = await this.deps.sessions.findByTokenHash(hashToken(rawToken));
    if (!session || session.revokedAt || session.expiresAt <= this.now()) return null;
    return { sessionId: session.id, userId: session.userId };
  }

  async logout(sessionId: string) {
    await this.deps.sessions.revoke(sessionId, this.now());
  }

  private async openSession(account: AccountRecord, userAgent?: string) {
    const token = generateSessionToken();
    await this.deps.sessions.create({
      userId: account.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(this.now().getTime() + this.ttl),
      userAgent,
    });
    return { token, user: { id: account.id, email: account.email, fullName: account.fullName, kind: account.kind } };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash(DUMMY_HASH_PLACEHOLDER);
    return this.dummyHash;
  }
}

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new AuthError("VALIDATION");
  return r.data;
}

export type { RegisterInput, LoginInput };
