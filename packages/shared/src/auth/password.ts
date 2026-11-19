// Password hashing with PBKDF2-SHA256 through the Web Crypto API. Web Crypto runs on Node.js and on
// Cloudflare Workers. (Argon2 via WebAssembly is blocked on Workers, so it cannot be used there.)
// Stored format: pbkdf2_sha256$<iterations>$<salt base64>$<hash base64>
import type { PasswordHasher } from "./service";

// Workers' Web Crypto limit for PBKDF2 is 100,000 iterations.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const passwordHasher: PasswordHasher = {
  async hash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const digest = await derive(password, salt, ITERATIONS);
    return `pbkdf2_sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(digest)}`;
  },
  async verify(stored, password) {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS) return false;
    try {
      const salt = fromBase64(parts[2]);
      const expected = fromBase64(parts[3]);
      const digest = await derive(password, salt, iterations);
      return constantTimeEqual(digest, expected);
    } catch {
      return false;
    }
  },
};
