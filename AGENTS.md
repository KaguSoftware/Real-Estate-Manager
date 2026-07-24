<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Performance rules

Measured against this project's production database (2026-07-20), not assumed.
**A round-trip costs ~330ms. A query added to an existing wave costs ~12ms.**
1 query = 327ms · 6 in one `Promise.all` = 339ms · the same 6 serially = 1961ms.

- **Count waves, not queries.** A new stat goes *inside* the page's existing
  `Promise.all`, never in an `await` above it.
- **Never `getUser()` for identity.** It is a network call to the auth server
  (~330ms). Use `getUserId(supabase)` (`lib/supabase/server.ts`) on the server or
  `requireUser()` (`lib/db/requireUser.ts`) on the client — both verify the ES256
  JWT locally. RLS is what authorizes; the local check is safe.
  The one exception is `auth/callback/route.ts`, which straddles the token
  exchange — leave it alone.
- **No `await` inside a loop.** Batch it: `.in("id", ids)` for deletes,
  `createSignedUrls` (plural) for storage, one `Promise.all` otherwise.
- **Prefer one embedded select over a chain.** `properties?select=*,leases(*,…)`
  beats property → lease → tenant. Watch for ambiguous embeds when a table has
  two FKs to the same target (name the constraint: `tenants!leases_tenant_id_fkey`).
- **Filter small, team-scoped lists in the browser** (`lib/clientFilters.ts`),
  not by folding filter values into a cache key — that refetches per keystroke.
  Mirror the server predicate and unit-test the two together.
- **Don't add a Vercel `regions` setting without measuring.** The database is
  already fronted in Istanbul (`CF-RAY …-IST`, 38ms connect). Pinning a region
  the way a Tokyo-hosted project would need will make this app *slower*.
