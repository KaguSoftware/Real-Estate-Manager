# Supabase Setup — Step-by-Step

## 1. Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Choose your organisation, give the project a name (e.g. `kagu-realestate`), set a strong database password, and pick a region close to your users.
4. Wait ~2 minutes for the project to provision.

## 2. Run the Migrations

Migrations live in `supabase/migrations/` and must run **in numeric order**:

| File | What it creates |
| --- | --- |
| `0001_init.sql` | `profiles`, `properties`, `tenants`, `leases`, `payments` + RLS, triggers, admin helpers |
| `0002_property_images.sql` | `property_images` table + public `property-images` storage bucket |
| `0003_sales.sql` | `sales` table + Turkish tapu fields on properties |
| `0004_property_coords.sql` | latitude/longitude columns |
| `0005_leads.sql` | `leads` (client CRM) table |
| `0006_furnished.sql` | furnished flag |
| `0007_rental_kira.sql` | Turkish kira-sözleşmesi lease fields (guarantor, utilities, inventory) |
| `0008_profile_settings.sql` | per-user `profiles.settings` JSONB (attention thresholds) |
| `0009_documents_bucket.sql` | private `documents` storage bucket for generated contract PDFs |

### Option A — SQL Editor (quickest)

1. In the Supabase Dashboard, open the **SQL Editor** (left sidebar).
2. Click **New query**, paste the contents of each migration file **in order**, and **Run** each one.
3. Verify in **Table Editor** that these tables appear: `profiles`, `properties`, `tenants`, `leases`, `payments`, `property_images`, `sales`, `leads`.
4. Verify in **Storage** that the `property-images` (public) and `documents` (private) buckets exist.

### Option B — Supabase CLI

```bash
npm install -g supabase
supabase link --project-ref <your-project-id>
supabase db push
```

## 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in your values.
   Find them in the Supabase Dashboard → **Settings** → **API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by the admin panel API route)

3. `.env.local` is already in `.gitignore` — never commit it.

## 4. Enable Email Auth (Magic Link)

In the Supabase Dashboard:

1. Go to **Authentication** → **Providers**.
2. Ensure **Email** is enabled.
3. Under **Email** settings, turn on **Enable magic link** (passwordless sign-in).
4. Set your **Site URL** to `http://localhost:3000` for local dev.
5. Add any production URLs to **Additional redirect URLs** before deploying.

## 5. Verify

```bash
npm run dev
```

Sign in with a magic link, add a property, and check the browser console for Supabase errors. To make yourself an admin (unlocks `/admin`), set your row's `app_role` to `admin` in the `profiles` table.
