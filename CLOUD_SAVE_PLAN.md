# Cloud Save & RBAC — Implementation Plan

## 1. Current State Summary

### Store Architecture
- **Single Zustand store** (`useAppStore`) with no persistence middleware — everything lives in memory.
- **`DocumentData`** is a flat object (~30 fields) holding all document content: type, titles, client info, AI-generated text, arrays of deliverables/line items/metrics, custom sections, and section ordering.
- **`AppState`** wraps the document with `language`, `hiddenFields`, and CRUD actions (`updateDocument`, `addArrayItem`, `removeArrayItem`, `resetDocument`).
- **No user concept** exists anywhere — no auth, no user ID, no saved-document list.
- **No persistence** — refreshing the page loses all work.

### Key Files
| File | Role |
|------|------|
| `src/store/types.ts` | `DocumentData`, `DocType`, row interfaces |
| `src/store/initialState.ts` | Default blank document + `generateId()` |
| `src/store/useAppStore.ts` | Zustand `create()` — the single store |
| `src/store/index.ts` | Re-exports |
| `src/app/page.tsx` | Root page — renders `BuilderSidebar` + `LivePreview` |
| `src/app/layout.tsx` | Root layout — fonts, theme, no providers |
| `src/components/forms/DocumentForm/DocumentForm.tsx` | All form inputs + AI generate button |
| `src/components/preview/LivePreview/LivePreview.tsx` | PDF preview + section ordering + export |
| `src/app/api/generate-intro/route.ts` | AI generation API route (Groq SDK) |
| `src/lib/translations.ts` | i18n dictionary (en/ar/tr) |
| `src/lib/pdf.ts` | PDF export logic |

---

## 2. Proposed Supabase Schema

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (mirrors auth.users, populated via trigger)
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  display_name TEXT,
  app_role    TEXT NOT NULL DEFAULT 'member'
              CHECK (app_role IN ('admin', 'member', 'client')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE public.documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  doc_type    TEXT NOT NULL DEFAULT 'proposal',
  content     JSONB NOT NULL DEFAULT '{}'
              -- Guard against accidental mega-documents (~500 KB limit).
              CHECK (pg_column_size(content) < 500000),
  -- content stores the full DocumentData object as JSON
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON public.documents(owner_id);

-- ============================================================
-- UPDATED_AT TRIGGERS (profiles + documents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DOCUMENT ACCESS (per-document sharing)
-- ============================================================
CREATE TABLE public.document_access (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- No 'owner' role here — ownership is tracked solely via documents.owner_id.
  -- This table is only for granted access (editor / viewer).
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('editor', 'viewer')),
  granted_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (document_id, user_id)
);

CREATE INDEX idx_doc_access_user ON public.document_access(user_id);
CREATE INDEX idx_doc_access_doc  ON public.document_access(document_id);
```

---

## 3. Row-Level Security Policies

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: public.is_admin()
-- ============================================================
-- SECURITY DEFINER so it reads profiles with elevated privileges,
-- bypassing the restrictive profiles RLS policy below. Without this,
-- every RLS policy that needs an admin check would embed its own
-- EXISTS subquery against profiles — creating a circular RLS
-- dependency (profiles policies would fire during documents policy
-- evaluation) and duplicating logic in 7+ places. A single
-- SECURITY DEFINER function is the canonical Supabase pattern:
-- one place to audit, no circular evaluation, better plan caching.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND app_role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- HELPER: public.find_user_by_email(text)
-- ============================================================
-- Returns just {id, email} for a given email address.
-- SECURITY DEFINER so it bypasses profiles RLS — callers cannot
-- enumerate profiles or see display_name/app_role. The ShareModal
-- MUST call this function via supabase.rpc('find_user_by_email', { email })
-- instead of querying the profiles table directly.
CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email TEXT)
RETURNS TABLE (id UUID, email TEXT) AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── PROFILES ──────────────────────────────────────────────────

-- Users can only read their own profile. Admins can read all.
-- Share-by-email lookups go through find_user_by_email() instead.
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── DOCUMENTS ─────────────────────────────────────────────────

-- Admins see all documents.
-- Non-admins see documents they own OR have been granted access to.
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  USING (
    public.is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.document_access
      WHERE document_id = documents.id AND user_id = auth.uid()
    )
  );

-- Only the document owner can insert (enforced: owner_id must match auth.uid)
CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Owner and editors can update a document.
-- Admins can also update any document.
CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE
  USING (
    public.is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.document_access
      WHERE document_id = documents.id AND user_id = auth.uid() AND role = 'editor'
    )
  );

-- Only the owner (or admin) can delete a document
CREATE POLICY "documents_delete"
  ON public.documents FOR DELETE
  USING (
    public.is_admin()
    OR owner_id = auth.uid()
  );

-- ── DOCUMENT ACCESS ───────────────────────────────────────────

-- Users can see access entries for documents they can already see
CREATE POLICY "doc_access_select"
  ON public.document_access FOR SELECT
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_access.document_id AND owner_id = auth.uid()
    )
  );

-- Only the document owner (or admin) can grant access
CREATE POLICY "doc_access_insert"
  ON public.document_access FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_access.document_id AND owner_id = auth.uid()
    )
  );

-- Only the document owner (or admin) can modify access grants
CREATE POLICY "doc_access_update"
  ON public.document_access FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_access.document_id AND owner_id = auth.uid()
    )
  );

-- Only the document owner (or admin) can revoke access
CREATE POLICY "doc_access_delete"
  ON public.document_access FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_access.document_id AND owner_id = auth.uid()
    )
  );
```

---

## 4. File-by-File Change List

### New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | **NEW** — Browser Supabase client singleton (`createBrowserClient`) |
| `src/lib/supabase/server.ts` | **NEW** — Server-side Supabase client for API routes / server components |
| `src/lib/supabase/middleware.ts` | **NEW** — Session refresh logic called from Next.js middleware |
| `src/middleware.ts` | **NEW** — Next.js middleware to refresh Supabase auth session on every request |
| `src/lib/supabase/types.ts` | **NEW** — Generated Supabase DB types (via `supabase gen types`) |
| `src/components/auth/AuthModal.tsx` | **NEW** — Sign-in modal (magic-link auth only — no password). User enters email, receives a login link, clicks it, done. |
| `src/components/auth/AuthProvider.tsx` | **NEW** — Client component wrapping children; listens to `onAuthStateChange`, syncs user to store |
| `src/components/auth/UserMenu.tsx` | **NEW** — Top-right avatar/dropdown: user email, sign out, "My Documents" |
| `src/components/documents/MyDocumentsPanel.tsx` | **NEW** — Slide-over panel listing saved docs with load/delete actions |
| `src/components/documents/ShareModal.tsx` | **NEW** — Modal to share a doc by email; select role (editor/viewer). **Must** resolve emails via `supabase.rpc('find_user_by_email', { lookup_email })` — never query the `profiles` table directly (RLS blocks it). |
| `src/components/documents/SaveButton.tsx` | **NEW** — "Save" button component; creates or updates document in Supabase. On save, `documents.title` is derived from `document.projectTitle` with fallback `"Untitled [doc_type]"` (e.g. "Untitled proposal"). |
| `src/app/api/documents/route.ts` | **NEW** — API route: GET (list user's docs), POST (create doc) |
| `src/app/api/documents/[id]/route.ts` | **NEW** — API route: GET (single doc), PUT (update), DELETE |
| `src/app/api/documents/[id]/share/route.ts` | **NEW** — API route: POST (grant access), DELETE (revoke access), GET (list collaborators) |
| `.env.local` | **NEW** — Supabase URL + anon key (not committed) |

### Modified Files

| File | Changes |
|------|---------|
| `src/store/types.ts` | **MODIFIED** — Add `UserProfile` interface. Add `DocumentRole = 'editor' \| 'viewer'` type (no `'owner'` — ownership is on `documents.owner_id`). Add optional `currentDocumentId?: string` and `savedDocuments?: SavedDocumentMeta[]` to a new `CloudState` type (not inside `DocumentData` — keep that pure). |
| `src/store/useAppStore.ts` | **MODIFIED** — Add new state slices: `user: UserProfile \| null`, `currentDocumentId: string \| null`, `savedDocuments: SavedDocumentMeta[]`, `isSaving: boolean`, `isLoading: boolean`. Add actions: `setUser`, `setCurrentDocumentId`, `setSavedDocuments`, `loadDocument`, `setIsSaving`, `setIsLoading`. No existing fields removed or renamed. |
| `src/store/initialState.ts` | **MODIFIED** — Add default values for new cloud fields (`user: null`, `currentDocumentId: null`, etc.) |
| `src/store/index.ts` | **MODIFIED** — Re-export new types |
| `src/app/layout.tsx` | **MODIFIED** — Wrap `{children}` with `<AuthProvider>` (client component boundary). No font/style changes. |
| `src/app/page.tsx` | **MODIFIED** — Add `<UserMenu>` to the header area. Add `<MyDocumentsPanel>` as a slide-over. (SaveButton lives in BuilderSidebar, not here.) |
| `src/components/forms/BuilderSidebar/BuilderSidebar.tsx` | **MODIFIED** — Add `<SaveButton>` in the header bar, next to the language toggle (right side). Minor layout tweak only. |
| `package.json` | **MODIFIED** — Add `@supabase/supabase-js` and `@supabase/ssr` dependencies |
| `next.config.ts` | **MODIFIED** — Add `env` block or `images.remotePatterns` if needed for Supabase avatar URLs (likely minimal) |
| `.gitignore` | **MODIFIED** — Ensure `.env.local` is listed (likely already is) |

### Untouched Files

| File | Reason |
|------|--------|
| `src/app/api/generate-intro/route.ts` | AI generation — no changes needed |
| `src/lib/translations.ts` | Only add translation keys in a later prompt if we localize auth UI |
| `src/lib/pdf.ts` | PDF export — unrelated to cloud save |
| `src/components/preview/LivePreview/LivePreview.tsx` | Preview rendering — no changes (ShareModal is invoked from page-level, not preview) |
| `src/components/forms/DocumentForm/DocumentForm.tsx` | Form fields — no changes |
| `globals.css` | Styling — explicitly excluded per constraints |
| All section-specific form components (`ProposalFields`, etc.) | Untouched |
| All preview section components (`DocHeader`, etc.) | Untouched |

---

## 5. New Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `@supabase/supabase-js` | `^2` | Core Supabase client (auth, database, realtime) |
| `@supabase/ssr` | `^0.5` | SSR-compatible session handling for Next.js App Router (cookie-based auth) |

That's it — only 2 new packages. No ORM, no extra auth library.

---

## 6. Environment Variables

```env
# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

- `NEXT_PUBLIC_` prefix is required so the browser client can access them.
- The **service role key** is NOT needed — all access goes through RLS with the anon key + user JWT.

---

## 7. Phased Rollout

### Prompt 2 — Supabase Backend Setup
- Create Supabase project (manual step — documented).
- Run the SQL schema above (tables, triggers, RLS policies, helper functions).
- Generate TypeScript types with `supabase gen types typescript`.
- Add `@supabase/supabase-js` and `@supabase/ssr` to `package.json`.
- Create `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`.
- Create `src/middleware.ts` for session refresh.
- **Middleware warning**: The middleware and Supabase client setup **must** follow the official guide at https://supabase.com/docs/guides/auth/server-side/nextjs exactly. Do not improvise session handling — cookie chunking, token refresh, and PKCE flow details change between `@supabase/ssr` versions and the guide is the source of truth.
- Add `.env.local` with placeholder values.
- **Deliverable**: Supabase client wired up, no UI changes yet, app still works identically.

### Prompt 3 — Auth + Save/Load
- Create `AuthProvider`, `AuthModal` (magic-link only — no password auth), `UserMenu` components.
- Wrap layout with `AuthProvider`.
- Add `user`, `currentDocumentId`, `isSaving`, `isLoading` to the store.
- Create `SaveButton` component in BuilderSidebar header (next to language toggle). Upsert logic: insert if no `currentDocumentId`, update if exists. Title derived from `document.projectTitle || "Untitled [doc_type]"`.
- Create `MyDocumentsPanel` with list/load/delete.
- Create API routes for documents CRUD.
- **Deliverable**: Users can sign in via magic link, save documents, load them back. Anonymous users still use the app without auth — save button shows "Sign in to save".

### Prompt 4 — RBAC + Sharing UI
- Create `ShareModal` component (enter email, pick role: editor or viewer, grant access). Must resolve email via `supabase.rpc('find_user_by_email')` — never query profiles directly.
- Create sharing API route.
- Add document access indicators (shared badge, role label).
- Enforce editor vs. viewer permissions in the UI (viewers see read-only form, no Generate button).
- Admin dashboard (optional, stretch): list all users, all documents.
- **Deliverable**: Full RBAC working — owners share docs, editors can modify, viewers can only read, clients see only what's shared with them, admins see everything.

---

## 8. Risks and Gotchas

### Store Shape
- `DocumentData` is a large flat object with many optional arrays. Storing it as `JSONB` in Supabase is the right call — avoids 15+ junction tables. But it means we need to be careful about partial updates (always send the full `content` blob on save, not patches).

### `generateId()` Uses `Math.random()`
- Current IDs (`Math.random().toString(36).substr(2,9)`) are not UUIDs. This is fine for in-memory use but could cause collisions across users. For cloud-saved documents, the document's primary key is a proper UUID from Postgres. The internal row IDs (deliverables, line items) stay as-is since they're scoped within a single document's JSONB.

### No Debounced/Auto-Save
- Per the requirements, save is manual (button press). But we should warn the user about unsaved changes before navigating away (`beforeunload` event) or loading a different document.

### Anonymous → Authenticated Transition
- If a user builds a document while logged out, then signs in, we should offer to save their current work. The `AuthProvider` should detect this edge case: if `document` has meaningful content and `currentDocumentId` is null after login, prompt to save.

### RLS Performance
- The `documents_select` policy uses `EXISTS` subqueries on `document_access`. For large-scale usage this could slow down. For the expected scale (small team), this is fine. Add `USING` index hints if needed later.

### Client Role Enforcement
- RLS handles server-side security, but the UI should also reflect permissions. A `viewer` should not see the Generate button or be able to edit form fields. This is Prompt 4 work — the store will need a `currentDocumentRole` field to drive conditional rendering.

### Supabase Auth Session + Next.js App Router
- Next.js 15 App Router with `@supabase/ssr` requires cookie-based sessions (not localStorage). The middleware refreshes the session token on each request. This is well-documented by Supabase but requires careful setup — the `middleware.ts` file is critical.

### Hard Constraints Verification
- **No breaking changes**: Anonymous flow untouched. All new store fields have defaults, existing ones preserved.
- **AI route untouched**: `generate-intro` route has no auth dependency.
- **PDF/preview untouched**: Export and preview logic don't interact with cloud save.
- **No style changes**: `globals.css` and fonts remain untouched. New components use existing Tailwind/DaisyUI classes.
- **Backward-compatible store**: Only additive fields. `DocumentData` shape unchanged — new fields go on `AppState` level.
