import { createHash, randomBytes } from "node:crypto";

// Opaque session tokens: 32 random bytes, base64url. Only the SHA-256 hash is stored.
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
