# LAUNCH RUNBOOK — manual steps only you can do

Everything code-side is done in this repo. The items below need your Supabase/
Vercel dashboards or third-party accounts. Ordered by priority — top items
block real users.

## 1. Fix the service-role key (5 min, CRITICAL — things are silently broken)

`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is actually the **anon** key (its
JWT decodes to `"role":"anon"`). Until fixed, these fail silently: admin user
list, invite emails, billing-webhook subscription updates, account deletion,
the trial cron.

- Supabase Dashboard → Project Settings → API → copy the **service_role** key
  (starts the same but decodes to `"role":"service_role"`).
- Paste into `.env.local` AND Vercel → Project → Settings → Environment
  Variables (Production + Preview).

## 2. Apply the two new migrations (5 min, CRITICAL)

0012/0013 are already live (verified 2026-07-11). Run these in Supabase
Dashboard → SQL Editor, in order:

1. `supabase/migrations/0014_seats_lifecycle_hardening.sql`
   (seat limits, team delete/leave/transfer, search_path hardening)
2. `supabase/migrations/0015_turkish_notifications_cron.sql`
   (Turkish notification texts + cron sweep function)

## 3. Un-stick your own team (2 min — this is the logo-upload bug)

Your team's 14-day trial has expired and billing can't take payments yet, so
RLS makes the whole workspace read-only — that's why the logo upload kept
failing with "no permission". Extend your trial until iyzico is live
(SQL Editor):

```sql
update public.teams
set trial_ends_at = now() + interval '90 days'
where name = 'YOUR TEAM NAME';  -- or: where owner_id = 'your-user-uuid'
```

Afterwards sign out/in (or wait a minute) and upload the logo — it will work.

## 4. Auth URL configuration (5 min, CRITICAL — signups are broken without it)

Confirmation emails currently redirect to `http://localhost:3000` because the
Supabase **Site URL** was never changed.

Supabase Dashboard → Authentication → URL Configuration:
- **Site URL** → `https://re-demo-amber.vercel.app` (or your final domain)
- **Redirect URLs** → add BOTH:
  - `https://re-demo-amber.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

And on Vercel set `NEXT_PUBLIC_SITE_URL=https://re-demo-amber.vercel.app`.

## 5. Custom SMTP (30 min, CRITICAL before real signups)

Supabase's built-in mailer is rate-limited to a few emails/hour — signups will
break at user #3.

- Create a [Resend](https://resend.com) account (or Postmark/SES), verify your
  sending domain (SPF + DKIM records).
- Supabase Dashboard → Authentication → SMTP Settings → enter the credentials.
- While there, paste the branded Turkish templates from `supabase/templates/`
  into Authentication → Email Templates.

## 6. Vercel environment & cron (10 min)

Settings → Environment Variables (Production):
- `NEXT_PUBLIC_SITE_URL` — your production URL
- `SUPABASE_SERVICE_ROLE_KEY` — the real one (step 1)
- `CRON_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
  Vercel automatically sends it with the daily `/api/cron/trial-check` cron
  (configured in `vercel.json`), which notifies owners about expiring trials
  even when they don't open the app.
- `BILLING_PROVIDER=iyzico`

Optional but recommended:
- **Upstash Redis** (Vercel Marketplace) → sets `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` → makes rate limiting work across serverless
  instances (in-memory fallback is per-instance).
- `NEXT_PUBLIC_SENTRY_DSN` — only if you want a different Sentry project per
  environment; set to empty string to disable Sentry in an environment.

## 7. Legal pages (before charging money)

`/kullanim-kosullari`, `/gizlilik-politikasi`, `/kvkk-aydinlatma` are drafted
in Turkish with placeholders: **[ŞİRKET UNVANI], [ADRES], [E-POSTA], [MERSİS],
[ŞEHİR], [BÖLGE], [SMTP SAĞLAYICISI]** — fill them in and **have a lawyer
review all three** (KVKK compliance is real exposure: the app stores tenants'
national IDs). Signup now requires accepting them.

## 8. Security hygiene

- **Rotate the Supabase account password now** — it was pasted into a chat
  session (this one).
- Consider enabling MFA on the Supabase and Vercel accounts.
- Supabase Pro: verify daily backups + point-in-time recovery are enabled.

## 9. When the iyzico API keys arrive

- Fill `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` (+ `IYZICO_BASE_URL` prod URL)
  locally and on Vercel.
- Implement `src/lib/billing/iyzico.ts` (the three TODOs: checkout form init,
  cancel, webhook signature verify + event mapping). Everything around it —
  checkout/cancel routes, webhook idempotency, state machine, UI — is done and
  tested with the mock provider.
- Test on sandbox: trial → subscribe → payment fail (past_due, 7-day grace) →
  recover → cancel.
- Reduce the 90-day trial extension from step 3 back to a sensible date.

## Optional: hand me a token to automate the dashboard steps

Steps 2–3 can be scripted if you create a **Personal Access Token**
(Supabase Dashboard → Account → Access Tokens) — the account password can't be
used programmatically and shouldn't be shared anyway.
