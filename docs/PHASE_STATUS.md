# Phase status

## Phase 1 — Foundation: code complete, runtime checks blocked

| Item | Status | Notes |
|---|---|---|
| Monorepo (npm workspaces) | Done | `apps/web`, `packages/shared`, `packages/database` |
| Design tokens from reference screens | Done | `apps/web/app/globals.css` |
| Role and permission model | Done, tested | 4 tests |
| Order status state machine | Done, tested | 6 tests |
| Money math (integer minor units) | Done, tested | 6 tests |
| Authentication service (register, login, sessions, logout, suspension, enumeration-safe errors) | Done, tested | 7 tests, in-memory stores |
| Argon2id hashing | Done for Node, tested | `@node-rs/argon2`, OWASP minimum parameters. **Not verified on Workers**: native binary, needs a WebAssembly build |
| Session tokens | Done, tested | 32 random bytes, only SHA-256 stored |
| Prisma schema (full entity model) | Written, **not validated** | Prisma engine downloads blocked by policy (403 from binaries.prisma.sh) |
| Database adapters (Postgres store implementations of the auth ports) | Not started | Needs Prisma client generation |
| Migrations | Not started | Needs PostgreSQL and Prisma binaries |
| Cloudflare runtime verification | Not started | OpenNext has a Workers guide and a Hyperdrive Prisma guide. Not yet tested here |
| Git branches `main` (production) and `dev` (development) | Done (local only) | No remote configured, so nothing is deployed yet |
| Separate env files per environment | Template only | `.env.example`; real values never committed |

## Phase 2 — Menu and customer website: domain and UI shell done, data not wired

| Item | Status | Notes |
|---|---|---|
| Price resolution (discount, variants) | Done, tested | `packages/shared/src/catalog/pricing.ts` |
| Modifier rules (required, min and max, availability) | Done, tested | Same file |
| Server-side cart pricing (never trusts client prices) | Done, tested | `priceCart()` |
| Menu page and search and category filter | Done, builds | `/menu`. Shows an honest empty state |
| Menu data from the database | **Not wired** | `apps/web/lib/catalog-source.ts` returns an empty catalog until Prisma is available |
| Cart, checkout, customer accounts UI | Not started | Auth service exists. Pages and API routes still to write |
| Terms, privacy, contact pages | Not started | Need the restaurant's actual content |
| Product images (R2 upload) | Not started | |

## Blockers

1. **Topify documentation.** `https://pay.topify.ng/docs` is not on the fetch allowlist, and search did not return it. Phase 5 is blocked until the docs are provided.
2. **Prisma binaries.** `binaries.prisma.sh` is denied by policy. This blocks `prisma validate`, `generate`, migrations, and so the database-backed menu and auth stores.
3. **Workers-compatible Argon2id.** Choose and test a WebAssembly Argon2id build before deploying auth to Workers.
4. **Brand palette and logo.** Colors are estimates from the screenshots.

## Design direction

See `docs/DESIGN.md`.
