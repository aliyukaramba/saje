# Restaurant Platform

Single-restaurant ordering and management system: website, iOS and Android apps, QR table ordering, POS, delivery and pickup, kitchen display, inventory, reservations and reporting.

## Layout

- `apps/web` — customer website and admin dashboard (Next.js)
- `packages/shared` — permissions, order state machine, money math (pure TypeScript, tested)
- `packages/database` — Prisma schema (PostgreSQL)
- `docs/PHASE_STATUS.md` — what is done, what is blocked

## Commands

    npm install
    npm run test          # shared business logic tests
    npm run build:web     # production build of the web app
    npm run db:validate   # needs Prisma engines reachable

## Environment

Copy `.env.example` to `.env`. Never commit `.env`. Development and production use separate database URLs and secrets.

## Status

See `docs/PHASE_STATUS.md`. Phase 1 is partly done; Topify integration (Phase 5) is blocked on the Topify documentation.
