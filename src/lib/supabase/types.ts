// TODO: Replace this placeholder with generated types once you have created the
// Supabase project and run the migration.
//
// To regenerate:
//   npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
//
// Or using the local CLI:
//   npx supabase gen types typescript --local > src/lib/supabase/types.ts

// Placeholder shape that satisfies the supabase-js Database generic constraint.
// The `public` schema key with Tables/Views/Functions is required — without it
// createBrowserClient<Database> would resolve the schema to `never` and make
// all .from() / .rpc() calls type as `never`.
//
// Replace this entire file with the output of:
//   npx supabase gen types typescript --project-id <your-project-id>
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
