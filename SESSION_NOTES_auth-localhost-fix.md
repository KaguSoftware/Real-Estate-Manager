# Session notes — auth "localhost redirect" fix (2026-07-13)

> Temporary handoff so you can pick up on another device. **Safe to delete** once read.
> Everything code-side is committed + pushed to `main` (commit `bcd83ea`).

## The problem you reported
Auth was broken across every flow and "sends you to localhost sometimes."

**Root cause (confirmed, and already documented in your own `LAUNCH_RUNBOOK.md`):**
It's mostly **configuration**, not flow logic.
1. Supabase **Site URL is still `http://localhost:3000`**. Email links render
   `{{ .ConfirmationURL }}` from that Site URL, and Supabase only honors a
   `redirect_to` that's in the **Redirect URLs allowlist** — otherwise it falls
   back to the (localhost) Site URL.
2. `NEXT_PUBLIC_SITE_URL` wasn't authoritative in code — it fell back to
   `window.location.origin` (localhost) / `kagu.app` / request origin, with
   **three different fallback domains** across files.

**NOTE / non-issue:** `src/proxy.ts` is CORRECT — in Next.js 16 `middleware` was
renamed to `proxy`. Do not rename it to `middleware.ts` (that would disable
session refresh). It's live and working.

## What I changed in code (done — pushed to main `bcd83ea`)
- **NEW `src/lib/siteUrl.ts`** — one `getSiteUrl(fallbackOrigin?)` helper. Uses
  `NEXT_PUBLIC_SITE_URL` → fallback origin → `https://kagu-realestate.com`
  (never localhost). Uses `||` so an empty env var also falls back.
- Rewired all URL builders to it: `AuthForm.tsx`, `app/auth/callback/route.ts`,
  `api/team/invite/route.ts`, `api/billing/checkout/route.ts`, `layout.tsx`,
  `robots.ts`, `sitemap.ts`, `team/page.tsx` (share link).
- **`/auth/callback` fix:** honor an explicit `?next` (e.g. `/reset-password`)
  BEFORE the team check — previously a team-less user resetting a password got
  hijacked to `/onboarding` and never reached the reset screen.
- Docs updated to the real domain: `LAUNCH_RUNBOOK.md`, `SUPABASE_SETUP.md`,
  `supabase/templates/README.md`. Added committed **`.env.example`**.
- `npm run typecheck` ✅ clean. `npm run lint` ✅ clean for my files.
  (Rebased onto 9 newer remote commits; resolved 1 import conflict in
  `checkout/route.ts` — kept both `BILLING_PERIODS` and `getSiteUrl`.)

## What I did live against https://kagu-realestate.com
- Site is up (HTTP 200).
- **Password login** for your existing owner account → HTTP 200, valid session
  returned. So the auth backend/credentials are fine — the breakage was the
  redirect/site-URL layer, matching the diagnosis.
- **Created the account `parsaxavier@gmail.com`** (same password you gave me)
  via the live Supabase signup API. A user id was assigned and a confirmation
  email was sent (account is pending confirmation). Forward me that email's link
  if you want me to trace where it lands.
  - Because the account now exists, the "invite parsaxavier from parsaa" path
    would be rejected as already-registered — direct signup was cleaner.

## ⚠️ YOU STILL NEED TO DO THIS (the actual unblock — I can't touch dashboards)
The code is robust now, but production stays broken until these are set:

1. **Vercel → Env Vars:** set `NEXT_PUBLIC_SITE_URL=https://kagu-realestate.com`
   for **Production AND Preview**, then **redeploy** (NEXT_PUBLIC_* is inlined at
   build time — no rebuild = no effect).
2. **Supabase → Authentication → URL Configuration:**
   - **Site URL** → `https://kagu-realestate.com`
   - **Redirect URLs** → add all:
     - `https://kagu-realestate.com/auth/callback`
     - `https://kagu-realestate.com/join/*`
     - `http://localhost:3000/auth/callback`
3. **Supabase → SMTP:** built-in mailer is throttled (~few/hr) → signups break
   at user #3. Set up Resend/Postmark custom SMTP (see `LAUNCH_RUNBOOK.md` §5)
   and paste the branded templates from `supabase/templates/`.
4. **Verify `SUPABASE_SERVICE_ROLE_KEY`** on Vercel actually decodes to
   `"role":"service_role"` (runbook §1 warns it may be the anon key) — otherwise
   invite emails / admin / billing webhooks silently fail.

After 1+2, do a fresh signup / resend confirmation and the email link should be
`https://kagu-realestate.com/auth/callback...` (no localhost).

## Verify end-to-end (after the config above)
On `https://kagu-realestate.com` in incognito: signup → confirm email (real
domain) → onboarding; password login; magic link; forgot-password →
`/reset-password`; team invite link is `.../join/<code>`. No `localhost:3000`
anywhere.

## Loose ends / FYI
- **Pre-existing lint error** (NOT mine, not auth): `src/components/ui/Sidebar.tsx:64`
  — `react-hooks/set-state-in-effect`. May block CI lint. Fix separately.
- **Repo moved on GitHub:** origin now redirects to
  `https://github.com/KaguSoftware/Real-Estate-Manager.git`. Push still works via
  the redirect, but consider:
  `git remote set-url origin https://github.com/KaguSoftware/Real-Estate-Manager.git`
- Full plan lives at `~/.claude/plans/so-right-now-the-fancy-planet.md`.
