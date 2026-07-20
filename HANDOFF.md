# Kagu Emlak — Handoff

> Read this first when starting a fresh chat. Companions: [PRODUCT.md](PRODUCT.md) ·
> [README.md](README.md) · [AGENTS.md](AGENTS.md) · [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) ·
> plan file: `C:\Users\MnS\.claude\plans\so-ive-got-some-zesty-shannon.md`

## Working style
- **Collaborate**: propose with a recommendation before locking user-facing or
  schema decisions. Don't unilaterally commit.
- **Plan mode** for non-trivial work; owner approves before build.
- **Migrations are applied by hand** in the Supabase SQL editor, not `db push`
  (see Gotchas — there is a data-destroying trap in `db push` on this repo).
- Git author is Parsa only — **no Co-Authored-By trailers**.
- Keep this file and the memory index in lockstep.

## What this is
Multi-tenant SaaS for Turkish emlak (real-estate) offices: property portfolio with
tapu fields, a lead CRM with preference-based matching, tenants/leases/rent
payments, and generated Turkish/Arabic contract PDFs. UI is entirely Turkish.
Agents are heavily mobile; owners work desktop. See [PRODUCT.md](PRODUCT.md).

**Current goal**: a 3-phase build derived from a real-estate source's field notes.
The thesis — Kagu is not a Sahibinden competitor; it is the *private* inventory
Sahibinden structurally cannot hold (unlisted new-construction project units that
arrive as construction-company Google Drive folders), made instantly retrievable
when a client states a budget.

## Stack & environment
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 +
daisyUI 5 · Supabase (Postgres + RLS on every table, magic-link auth, Storage) ·
@react-pdf/renderer · Leaflet · Zustand · zod · vitest. Dev OS: Windows 11.

> ⚠️ This repo pins a Next.js version with breaking changes vs. public docs. Read
> [AGENTS.md](AGENTS.md) and `node_modules/next/dist/docs/` before Next-specific work.

## Conventions
- All data access is client-side through `src/lib/db/*`; **authorization is RLS**,
  never app code. Team-scoped via `is_team_member(team_id)`; writes additionally
  gated on `team_is_writable(team_id)`.
- Inputs validated with zod at the db boundary (`src/lib/schemas/inputs.ts`).
- **No FX conversion anywhere.** Rentals are usually TRY, sales often USD. Money is
  only ever compared within one currency — see the budget guard in `score.ts`.
- Client caching: `src/lib/useCachedResource.ts` (stale-while-revalidate); call
  `invalidateCache(prefix)` after mutations.
- A refined zod schema (`.refine()`) has no `.partial()`. Export an unrefined base
  and a separate patch schema — see `leadInputObject` / `leadPatchSchema`.

## Current status

**All three phases are COMPLETE in code; NONE are live in the database.**
Verified 2026-07-20: `npm run typecheck`, `npm run lint`, `npm test`
(**98 passed**, 12 files) and `npm run build` all pass.

**Phase 1 — lead budget.** Budget is a first-class concept:
`leads.pref_min_price/max_price/currency`, price+currency filtering on
properties, and a scored match dimension (+3, reason `"bütçe içinde"`) that
hard-fails out-of-range but **skips** on currency mismatch or unpriced property.
Budget flows lead → "Eşleşen taşınmazları bul" → property filters → URL params.

**Phase 2 — projects.** `/projects` list (grouped by müteahhit firma) + detail
with the Drive button; full CRUD in `src/lib/db/projects.ts`; project selector
and "Sıfır / İkinci el" on the property form; new-build filter on the portfolio;
and `MatchingProjects`, which surfaces projects whose `price_from` fits the
active budget filter (same-currency only, never folded into the scorer).

**Phase 3 — brochure.** A `brochure` DocKind renders one page per selected
property, reusing the existing `PropertyListing` section. Wired to a
"Broşür oluştur" button in the property table's existing `BulkActionBar`.

⚠️ **Nothing has been exercised against a real database** (migration 0026 is
still unapplied) and none of it has been clicked through in a browser. The
brochure is covered by a real render test; the rest is compile-time only.

## File map (key files)
| File | What it does |
| --- | --- |
| [supabase/migrations/0026_budget_and_projects.sql](supabase/migrations/0026_budget_and_projects.sql) | **Unapplied.** Lead budget columns, `projects` table + RLS, `properties.project_id`/`is_new_build`, cross-team guard trigger |
| [src/lib/matching/score.ts](src/lib/matching/score.ts) | The match engine. Budget dimension + currency guard live here |
| [src/lib/db/types.ts](src/lib/db/types.ts) | Row types — `Lead`, `Property`, new `Project` |
| [src/lib/db/properties.ts](src/lib/db/properties.ts) | `PropertyFilter` (price/currency/project) + `listProperties` |
| [src/lib/schemas/inputs.ts](src/lib/schemas/inputs.ts) | zod boundary; `leadInputSchema` / `leadPatchSchema` split |
| [src/components/leads/LeadForm.tsx](src/components/leads/LeadForm.tsx) | Lead sheet; budget row leads the preferences block |
| [src/components/properties/PropertyFilters.tsx](src/components/properties/PropertyFilters.tsx) | Filter bar; "Bütçe" range, currency appears only once a bound is set |
| [src/components/properties/PropertyDashboard.tsx](src/components/properties/PropertyDashboard.tsx) | Store↔URL↔query filter mapping — the 3-place pattern any new filter must follow |
| [src/store/useAppStore.ts](src/store/useAppStore.ts) | Zustand `Filters` shape + `EMPTY_FILTERS`; `projects` slice |
| [src/lib/db/projects.ts](src/lib/db/projects.ts) | Project CRUD; `normalizeBlanks` turns "" into NULL for date/url columns |
| [src/components/projects/](src/components/projects/) | `ProjectDashboard`, `ProjectForm`, `ProjectDetail`, `MatchingProjects` |
| [src/lib/pdf/document.tsx](src/lib/pdf/document.tsx) | `PDFDocument`: cover + N content pages. Brochure = one page per property |
| [src/lib/pdf/imageData.ts](src/lib/pdf/imageData.ts) | `toDataUrl` — shared by the single-listing and brochure exports |
| [src/lib/pdf/brochure.test.tsx](src/lib/pdf/brochure.test.tsx) | Real `renderToBuffer` page-count assertions; guards the multi-page restructure |

## Roadmap / next steps
1. **← ACTIVE: apply migration 0026** (see Gotchas for the exact safe procedure).
   Everything below is blocked on this — all three phases read columns it adds.
2. Browser pass, in this order:
   - Create a project with an https Drive link → `/projects` groups it by firma,
     the Drive button opens in a new tab.
   - Add a property from the project page (`?project=` prefills the link) →
     it appears under "Bu projedeki taşınmazlar".
   - Lead with a budget → "Eşleşen taşınmazları bul" → `"bütçe içinde"` shows;
     switch the lead's currency → the dimension is skipped, not hard-failed;
     a matching project appears in "Bu bütçeye uyan projeler".
   - Select 3 properties → "Broşür oluştur" → cover + 3 pages, **no homeowner
     name and no ada/parsel number anywhere**. Select 16 → the button disables.
3. Commit all three phases.
4. Then: the parked items (see the scope ledger and the plan file).

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Brochure photos | Cover photo only, max 15 properties | Optional "all photos" for small selections, or server-side rendering to lift the cap | when agents hit the limit |
| Project units | Optional — a project can have zero property rows | Bulk unit entry (floor/type grid) if agents start entering whole buildings | when asked |
| Project matching | `MatchingProjects` filters on `price_from` + exact currency | Richer project matching (nitelik, delivery date) if `price_from` proves too blunt | after real use |
| Currency list | Hard-coded TRY/USD/EUR in four components (`LeadForm`, `PropertyFilters`, `ProjectForm`, + store default) | Shared constant — worth extracting now that it appears 4× | next touch |
| Projects on dashboard | Not surfaced in the needs-attention feed or KPIs | Delivery-date reminders, project-level stats | later |
| Parked note items | Not built, by design (source said "just keep them in mind") | Commission link/rate per satış office, KDV + document-ready flags, pre-payment terms, short-vs-long-term rent, finance tracker | after Phases 1–3 land in real use |

Note: the $400k vatandaşlık threshold needs **no schema** — it's a saved budget
filter once Phase 1 is live. Commission fields already exist on `sales`
(`buyer_commission_rate`, `seller_commission_rate`).

## Gotchas / open issues
- **☠️ NEVER run `npx supabase db push` on this repo as-is.** Migration
  [0010_multitenant.sql:175](supabase/migrations/0010_multitenant.sql#L175) contains an
  unconditional `TRUNCATE public.payments, leases, sales, property_images,
  properties, tenants, leads CASCADE` ("fresh start: data cleared"). The remote's
  `schema_migrations` table is empty because migrations were historically applied
  by pasting SQL, so `db push` treats all 26 files as unapplied and **replays that
  TRUNCATE, wiping all live data**.
  **Safe procedure**: paste the new migration into the Supabase SQL editor, then
  `npx supabase migration repair --status applied 0001 0002 … 0026` (writes
  tracking rows only, executes no SQL). After that, `db push` is safe for 0027+.
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is reportedly the **anon** key — see
  [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) §1. Admin list, invites, billing webhook,
  account deletion and the trial cron fail silently until fixed. **Unverified this session.**
- Team trial expiry makes the whole workspace read-only via RLS (writes gated on
  `team_is_writable`). A confusing "no permission" error is usually this, not a bug.
  Runbook §3 has the SQL to extend a trial.
- `supabase/.temp/` is CLI link state containing a pooler URL — gitignored 2026-07-20.
- Phase 1 is **untested against a live database and unclicked in a browser**.

## Running it
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm test           # vitest (85 tests)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on pushes and PRs.
