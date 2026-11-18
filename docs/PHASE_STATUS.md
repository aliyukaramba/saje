# Phase status

## Phase 1 — Foundation: partially complete

| Item | Status | Notes |
|---|---|---|
| Monorepo (npm workspaces) | Done | `apps/web`, `packages/shared`, `packages/database` |
| Design tokens from reference screens | Done | `apps/web/app/globals.css` |
| Web shell builds (`next build`) | Done | Static, no hardcoded menu data |
| Role and permission model | Done (logic + tests) | `packages/shared/src/permissions.ts` — 16 tests pass with `order-status` and `money` |
| Order status state machine | Done (logic + tests) | Rejects skipped and backward steps |
| Money math (integer minor units) | Done (logic + tests) | Discount, tax (basis points), delivery fee |
| Prisma schema (full entity model) | **Written, not validated** | Prisma engine downloads are blocked in this sandbox (403 from binaries.prisma.sh), so `prisma validate` could not run |
| Database migrations | Not started | Blocked on schema validation; needs a real PostgreSQL |
| Authentication (Argon2id, sessions) | Not started | Next step |
| Cloudflare runtime verification | Not started | Need to confirm Next.js adapter and Prisma driver support on Workers |
| Dev and prod environments (branches `dev` and `main`) | Not started | No git remote configured yet |

## Blockers

1. **Topify documentation.** `https://pay.topify.ng/docs` is not on the fetch allowlist, and web search did not return it. Per the spec, no payment endpoints or webhook formats will be guessed. Phase 5 is blocked until the docs are provided (paste the content or add the URL to the allowlist).
2. **Prisma binaries.** Needed for `prisma validate`, `generate` and `migrate`. Either allow `binaries.prisma.sh` or run the validation in an environment that can reach it.
3. **Cloudflare target.** Confirm the Workers compatibility approach (Next.js adapter, Prisma driver such as `@prisma/adapter-pg` with Hyperdrive) before Phase 2 deployment work.
4. **Brand palette.** Colors in `globals.css` are estimates from the screenshots. Confirm the restaurant's real palette and logo.

## Design direction (from the reference screens)

- Restoo dashboard: light canvas, white cards, deep-teal hero card, orange and black chart accents, tidy sidebar with grouped labels.
- Cravk food app: two-weight headlines (bold word plus light word), pill-shaped selectors with a black active state, black full-width primary button, orange-red prices, generous whitespace.
- Font: system stack for now. Adding Google Fonts requires network access that this environment does not have.
