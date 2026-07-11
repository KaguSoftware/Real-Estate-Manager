# Kagu Emlak

A multi-tenant SaaS for Turkish real-estate agencies: listings with tapu (title-deed) fields, leads with preference matching, tenants, leases (kira sözleşmesi), rent payments, and client-ready PDF contracts with Arabic/RTL support. Fully Turkish UI with light/dark themes, 14-day team trials, and iyzico subscription billing (provider wiring pending API keys).

> **Launching?** Work through [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) — the ordered checklist of dashboard/env steps that code can't do.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript strict
- **Tailwind CSS v4** + daisyUI 5
- **Supabase** — Postgres (RLS on every table), Auth (magic link), Storage (property photos, contract PDFs)
- **@react-pdf/renderer** for client-side contract/receipt/listing PDFs
- **Leaflet** maps, **Zustand** store, **zod** input validation, **vitest** tests

> ⚠️ This repo pins a Next.js version with breaking changes vs. public docs — read `AGENTS.md` and `node_modules/next/dist/docs/` before Next-specific work.

## Getting started

1. Set up Supabase (project, migrations `supabase/migrations/0001`–`0015` in order, magic-link auth) — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
2. `cp .env.example .env.local` and fill in the Supabase URL/keys.
3. Install and run:

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest unit tests (pure logic: filters, attention, matching, validation) |
| `npm run backfill:geocode` | Backfill property coordinates via Nominatim |

CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on pushes and PRs.

## Features

- **Dashboard** — needs-attention feed (overdue/upcoming rent, expiring leases, silent leads; thresholds configurable per user via the gear icon), KPI cards, portfolio health (occupancy, monthly collection), quick actions, recents.
- **Properties** — filterable/paginated list, map, photo galleries, detail page with lease/sale lifecycle (renew lease, end lease, record this month's rent, close/cancel sale), matching clients with match strength.
- **Clients (leads)** — pipeline statuses, preference fields, property match counts, one-tap "called today" logging (also appends a dated note), CSV export.
- **Tenants & payments** — tenant registry, per-lease payment history with balances, rent receipts.
- **Documents** — 5-step wizard generating rental/sales contracts (Turkish, Arabic RTL support). PDFs download locally and a copy is stored in the private `documents` bucket, linked from the property page.
- **Admin** — user/role management (requires `app_role = 'admin'` and `SUPABASE_SERVICE_ROLE_KEY`).

## Conventions

- All data access is client-side through `src/lib/db/*`; authorization is enforced by Postgres RLS (owner-scoped, admin override).
- Inputs are validated with zod at the db boundary (`src/lib/schemas/inputs.ts`).
- Currency: properties/leases default to TRY; sales fall back to USD when the property has no currency set (sales are commonly quoted in USD). No FX conversion — totals are reported per currency.
- Client caching: `src/lib/useCachedResource.ts` (stale-while-revalidate). After mutations, call `invalidateCache(prefix)` for affected keys (`stats`, `attention`, `leads`, `properties`, …).
