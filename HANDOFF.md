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

**Phase 5 — the gap backlog.** WhatsApp prefill with team-editable templates;
work notifications (overdue rent, expiring lease, quiet lead, project delivery)
swept daily; commission & earnings reporting on the dashboard.

✅ **All migrations are applied** — remote history in sync at 0001–0030
(verified 2026-07-20 via `supabase migration list --linked`).
✅ **`run_work_checks()` idempotency verified on the live database**: first run
inserted 4, second inserted 0.
✅ **Both cron sweeps verified blocked for the anon key** (SQLSTATE 42501) and
working for `service_role`.

⚠️ **None of it has been clicked through in a browser yet.** Schema is live and
the code compiles and passes 113 tests, but no phase has been exercised by a
real user against real data. The brochure has a genuine render test; the rest is
compile-time confidence only.

## File map (key files)
| File | What it does |
| --- | --- |
| [supabase/migrations/0026_budget_and_projects.sql](supabase/migrations/0026_budget_and_projects.sql) | *Applied.* Lead budget columns, `projects` table + RLS, `properties.project_id`/`is_new_build`, cross-team guard trigger |
| [supabase/migrations/0027_contact_activity.sql](supabase/migrations/0027_contact_activity.sql) | *Applied.* `contact_activity` table + RLS + cross-team guard; fixes the notes-clobbering data loss |
| [src/lib/db/contactActivity.ts](src/lib/db/contactActivity.ts) | Activity CRUD; also advances `leads.last_call_at` (never backwards) |
| [src/components/contacts/ActivityTimeline.tsx](src/components/contacts/ActivityTimeline.tsx) | Per-contact timeline + composer, mounted in Lead/Tenant forms (edit mode only) |
| [src/components/ui/Combobox.tsx](src/components/ui/Combobox.tsx) | Free-text input with filtered suggestions; used for city (81 provinces) |
| [src/lib/turkeyGeo.ts](src/lib/turkeyGeo.ts) | `TURKEY_PROVINCES` + `foldTr` (Turkish dotted-i-safe search folding) |
| [src/components/ui/DatePicker.tsx](src/components/ui/DatePicker.tsx) | Custom calendar replacing native `<input type="date">` everywhere |
| [src/lib/commission.ts](src/lib/commission.ts) | **`KDV_RATE` (0.20) lives here — never inline it.** Commission maths + per-currency totals |
| [src/lib/whatsappMessage.ts](src/lib/whatsappMessage.ts) | Token whitelist + template rendering; the reason a message can't leak homeowner/tapu data |
| [supabase/migrations/0029_work_notifications.sql](supabase/migrations/0029_work_notifications.sql) | `run_work_checks()` — the daily work sweep; every insert guarded by a 30-day NOT EXISTS |
| [supabase/migrations/0030_revoke_sweep_execute.sql](supabase/migrations/0030_revoke_sweep_execute.sql) | Closes the anon-callable sweep hole. **Revoke from PUBLIC, not just anon/authenticated** |
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
1. ~~Apply migrations 0026 + 0027.~~ **Done 2026-07-20** — remote history synced
   at 0001–0027. `db push` is safe here now; still `--dry-run` first (Gotchas).
2. **← ACTIVE: browser pass**, in this order:
   - Create a project with an https Drive link → `/projects` groups it by firma,
     the Drive button opens in a new tab.
   - Add a property from the project page (`?project=` prefills the link) →
     it appears under "Bu projedeki taşınmazlar".
   - Lead with a budget → "Eşleşen taşınmazları bul" → `"bütçe içinde"` shows;
     switch the lead's currency → the dimension is skipped, not hard-failed;
     a matching project appears in "Bu bütçeye uyan projeler".
   - Select 3 properties → "Broşür oluştur" → cover + 3 pages, **no homeowner
     name and no ada/parsel number anywhere**. Select 16 → the button disables.
   - **Phase 4 regression check**: open a lead → log 3 calls → all persist,
     newest first, attributed to you. Then clear the notes box and save →
     **the calls survive**. That failure is the bug this phase exists to fix.
   - City field: type "izmir" (no accents, lowercase) → "İzmir" appears in the
     suggestions; type "Alsancak" → no suggestion but the value still saves.
3. Commit Phases 1–4 (nothing is committed yet).
4. Then the gap backlog below, in order.

## Gap backlog — ALL THREE BUILT 2026-07-20

A, B and C below are **done** (Phase 5), migrations 0028–0030 applied, 140 tests
green. Kept here for the reasoning; the descriptions are now history, not TODO.

Two things found while building them:
- **KDV was 18 %, should be 20 %** (raised July 2023). It printed on every
  generated sales contract. Now a single `KDV_RATE` in
  [src/lib/commission.ts](src/lib/commission.ts), pinned by tests.
- **Both cron sweeps were callable with the public anon key** — a pre-existing
  hole, not introduced by this work. `REVOKE … FROM anon, authenticated` does
  nothing on its own because Postgres grants EXECUTE to `PUBLIC` on creation.
  Fixed in [0030](supabase/migrations/0030_revoke_sweep_execute.sql); verified
  blocked (SQLSTATE 42501) for anon and still working for `service_role`.


**A. WhatsApp prefilled message + brochure.** `whatsappUrl()`
([phone.ts:4-14](src/lib/phone.ts#L4-L14)) returns a bare `https://wa.me/<digits>`,
so the button opens an **empty chat**. `wa.me` supports `?text=` — prefill the
property address, price and key stats, and hand over the Phase 3 brochure.
Turkish agents work in WhatsApp; this closes the loop (budget → find → *share*).
Small change, high daily value. Pairs with logging a `whatsapp` activity row.

**B. Work notifications.** All seven `NotificationType` values
([notifications.ts:6-13](src/lib/db/notifications.ts#L6-L13)) are billing/team
lifecycle (`trial_started`, `invite_accepted`, `subscription_activated`…).
**None concern the actual job.** Overdue rent, expiring leases and silent leads
live only in a dashboard panel an agent must remember to open. The daily cron at
`/api/cron/trial-check`
([0015](supabase/migrations/0015_turkish_notifications_cron.sql)) is already the
delivery mechanism — it needs work-shaped notification types, not new plumbing.

**C. Commission & earnings.** `sales.buyer_commission_rate` /
`seller_commission_rate` ([0003_sales.sql:31-32](supabase/migrations/0003_sales.sql#L31-L32))
are **written** by the document wizard
([DocumentWizard.tsx:860-861](src/components/documents/DocumentWizard.tsx#L860-L861))
but **never read back into any view** — effectively write-only data. No screen
shows an agent what they earned or are owed, or an owner what the office booked.
The meeting notes raise commission repeatedly. With `assigned_to` already on
properties and leads, per-agent earnings is largely a reporting view over
existing data.

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
- **In new migrations use `gen_random_uuid()`, not `uuid_generate_v4()`.**
  The latter lives in the `uuid-ossp` schema, which is not on the CLI migration
  runner's `search_path` — `db push` fails with SQLSTATE 42883 even though the
  extension is installed and older migrations use it happily. 0027/0028 were
  switched; 0001–0026 still contain it and would fail if ever replayed.
- **`REVOKE EXECUTE … FROM anon, authenticated` does nothing on its own.**
  Postgres grants EXECUTE to `PUBLIC` when a function is created, and those
  roles inherit through it. Always `REVOKE … FROM PUBLIC, anon, authenticated`
  then `GRANT` back to `service_role` — see
  [0030](supabase/migrations/0030_revoke_sweep_execute.sql).
- **⚠️ Live data-loss bug: call history is stored in `leads.notes`.**
  `markCalledToday` ([ContactTable.tsx:92-105](src/components/contacts/ContactTable.tsx#L92-L105))
  prepends `[tarih] Arandı.` into the free-text `notes` column, but `LeadForm`
  loads `notes` into state and writes it back wholesale on save
  ([LeadForm.tsx:91](src/components/leads/LeadForm.tsx#L91)) — so an agent who
  clears the notes box and saves **silently erases every logged call**.
  `TenantForm` has the same shape. Phase 4 fixes this with a real
  `contact_activity` table. Until then, don't build anything else on `notes`.
  Note `leads.last_call_at` is also a single overwritten timestamp: only the
  most recent call is retained, by design.
- **`db push` is now SAFE — but always `--dry-run` first.** Migration
  [0010_multitenant.sql:175](supabase/migrations/0010_multitenant.sql#L175) contains an
  unconditional `TRUNCATE public.payments, leases, sales, property_images,
  properties, tenants, leads CASCADE` ("fresh start: data cleared"). It is
  **destructive if ever replayed**.
  As of 2026-07-20 the remote `schema_migrations` history is fully repaired
  (0001–0027 all recorded), so `db push` only applies genuinely new files and
  will not replay 0010. Verify with `npx supabase db push --dry-run --linked`
  and confirm the printed list contains *only* the migration you expect.
  If the history is ever reset or a fresh project is linked, that guarantee is
  gone: repair first (`npx supabase migration repair --status applied 0001 …`,
  which writes tracking rows without executing SQL), never push blind.
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
