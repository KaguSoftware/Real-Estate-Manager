// Supabase server client — created following the official @supabase/ssr guide:
// https://supabase.com/docs/guides/auth/server-side/nextjs
//
// Use this in Route Handlers and Server Components.
// Always create a new client per request — never share across requests.
// Uses Next.js `cookies()` (async in Next.js 15+) for cookie-based session handling.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// No Database generic here — the placeholder in ./types.ts is for documentation
// only. Once you run `supabase gen types` after the migration, import Database
// here and pass it: createServerClient<Database>(...)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component where cookies cannot be set.
            // This is safe to ignore — middleware handles the token refresh.
          }
        },
      },
    }
  )
}

/**
 * The signed-in user's id on the server, or null.
 *
 * Uses `getClaims()`, NOT `getUser()`. `getUser()` is a network round-trip to the
 * Supabase auth server (~300ms) — paid on every page render just to answer "is
 * anyone signed in?". This project signs JWTs with ES256 (asymmetric), so
 * `getClaims()` verifies the token locally via WebCrypto against a cached JWKS,
 * and still refreshes an about-to-expire session on the way through.
 *
 * This establishes identity for convenience only. RLS remains the authority on
 * what any query may read or write, which is why the local check is safe.
 */
export async function getUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ?? null
}
