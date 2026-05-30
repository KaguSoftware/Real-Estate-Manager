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
