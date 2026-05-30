// Supabase browser client — created following the official @supabase/ssr guide:
// https://supabase.com/docs/guides/auth/server-side/nextjs
//
// This file is safe to import from Client Components only.
// For server-side (Route Handlers, Server Components), use ./server.ts instead.

import { createBrowserClient } from '@supabase/ssr'

// No Database generic here — the placeholder in ./types.ts is for documentation
// only. Once you run `supabase gen types` after the migration, import Database
// here and pass it: createBrowserClient<Database>(...)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
