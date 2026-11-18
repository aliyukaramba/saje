// Argon2id via WebAssembly (hash-wasm). Works on Node.js and Cloudflare Workers.
// The native binary used before cannot load on Workers.
import { argon2id, argon2Verify } from "hash-wasm";
import type { PasswordHasher } from "./service";

// OWASP minimum guidance for Argon2id: m=19 MiB, t=2, p=1.
export const ARGON2_PARAMS = { memorySize: 19456, iterations: 2, parallelism: 1, hashLength: 32 } as const;

export const argon2Hasher: PasswordHasher = {
  async hash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return argon2id({ password, salt, ...ARGON2_PARAMS, outputType: "encoded" });
  },
  async verify(stored, password) {
    try {
      return await argon2Verify({ password, hash: stored });
    } catch {
      return false;
    }
  },
};
