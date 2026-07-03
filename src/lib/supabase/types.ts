// Supabase Database generic — currently a permissive placeholder.
//
// The app's real row types live in src/lib/db/types.ts (hand-maintained,
// verified against supabase/migrations/) and are applied at the data-layer
// boundary in src/lib/db/*. The clients in ./client.ts and ./server.ts are
// intentionally untyped; queries are cast to those manual types.
//
// To switch to generated types (requires a Supabase access token):
//   npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
// then pass the generic: createBrowserClient<Database>(...) in client.ts/server.ts.

// The `public` schema key with Tables/Views/Functions is required — without it
// createBrowserClient<Database> would resolve the schema to `never` and make
// all .from() / .rpc() calls type as `never`.
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
