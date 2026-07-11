"use client";

/**
 * AuthProvider — client component that subscribes to Supabase auth state changes
 * and keeps the Zustand store's `user` field in sync.
 *
 * Must be mounted inside layout.tsx (client boundary).
 * SSR-safe: the initial render sets user from the server session (or null) without
 * any mismatch — the subscription fires only on the client after hydration.
 */

import { useEffect } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";
import { clearCache } from "@/src/lib/useCachedResource";
import { fetchTeamContext } from "@/src/lib/db/teams";

async function resolveUser(supabase: ReturnType<typeof createClient>, id: string, email: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("app_role")
      .eq("id", id)
      .single();
    return { id, email, app_role: data?.app_role ?? undefined };
  } catch {
    return { id, email };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const setTeam = useAppStore((s) => s.setTeam);
  const setProperties = useAppStore((s) => s.setProperties);
  const setLeads = useAppStore((s) => s.setLeads);

  useEffect(() => {
    const supabase = createClient();
    // Supabase re-emits SIGNED_IN on token refresh / tab refocus for the SAME
    // user; clearing the cache then blanks every mounted list. Only clear when
    // the signed-in identity actually changes.
    let lastUserId: string | null = null;

    // Set user immediately from session, then enrich with app_role
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setUser(null); return; }
      lastUserId = user.id;
      setUser({ id: user.id, email: user.email ?? "" });
      resolveUser(supabase, user.id, user.email ?? "").then(setUser);
      fetchTeamContext().then(setTeam).catch(() => setTeam(null));
    });

    // Keep in sync as auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const u = session?.user ?? null;
        // Drop the SWR cache on real identity changes so one user never sees
        // another's cached rows. Token refresh keeps the same identity → keep cache.
        if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && u?.id !== lastUserId)) {
          clearCache();
        }
        lastUserId = u?.id ?? lastUserId;
        if (event === "SIGNED_OUT") lastUserId = null;
        if (event === "SIGNED_OUT") {
          // Single source of truth for store cleanup on sign-out.
          setProperties([]);
          setLeads([]);
          setTeam(null);
        }
        if (!u) { setUser(null); return; }
        setUser({ id: u.id, email: u.email ?? "" });
        resolveUser(supabase, u.id, u.email ?? "").then(setUser);
        fetchTeamContext().then(setTeam).catch(() => setTeam(null));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setTeam, setProperties, setLeads]);

  return <>{children}</>;
}
