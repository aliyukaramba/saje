// Argon2id adapter for Node.js (tests, local dev, and any Node-hosted worker).
// Not yet verified on Cloudflare Workers: the native @node-rs/argon2 binary will not
// load there. A WebAssembly Argon2id build must be chosen and tested before deploy.
import { hash, verify, Algorithm } from "@node-rs/argon2";
import type { PasswordHasher } from "./service";

// OWASP minimum guidance for Argon2id: m=19 MiB, t=2, p=1.
export const ARGON2_PARAMS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, ARGON2_PARAMS),
  verify: (stored, password) => verify(stored, password).catch(() => false),
};
