# Supabase Setup — Step-by-Step

## 1. Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Choose your organisation, give the project a name (e.g. `project1`), set a strong database password, and pick a region close to your users.
4. Wait ~2 minutes for the project to provision.

## 2. Run the Migration

### Option A — SQL Editor (quickest)

1. In the Supabase Dashboard, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Paste the entire contents of `supabase/migrations/0001_init.sql` into the editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. Verify in **Table Editor** that three tables appear: `profiles`, `documents`, `document_access`.

### Option B — Supabase CLI

```bash
# Install the CLI if you haven't already
npm install -g supabase

# Link to your project (you'll be prompted for the project ref and DB password)
supabase link --project-ref <your-project-id>

# Push the migration
supabase db push
```

## 3. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your values.  
   Find them in the Supabase Dashboard → **Settings** → **API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (not used in Phase 1, but document it now)

3. `.env.local` is already in `.gitignore` — never commit it.

## 4. (Optional) Generate TypeScript Types

After the migration has run, regenerate the typed client from your live schema:

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
```

This replaces the placeholder in `src/lib/supabase/types.ts` with full, accurate types for every table and RPC.

## 5. Verify

Start the dev server and open the browser console — no Supabase errors should appear:

```bash
npm run dev
```

The app should behave exactly as before (no UI changes in Phase 1). The Supabase client is wired up but not yet called until Phase 2 adds auth + save functionality.

## 6. Enable Email Auth (Magic Link)

In the Supabase Dashboard:

1. Go to **Authentication** → **Providers**.
2. Ensure **Email** is enabled.
3. Under **Email** settings, turn on **Enable magic link** (passwordless sign-in).
4. Set your **Site URL** to `http://localhost:3000` for local dev.
5. Add any production URLs to **Additional redirect URLs** before deploying.

> Magic link auth is used in Phase 2 — you can configure it now or later.
