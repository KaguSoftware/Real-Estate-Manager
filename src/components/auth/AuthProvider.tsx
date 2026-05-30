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

  useEffect(() => {
    const supabase = createClient();

    // Set user immediately from session, then enrich with app_role
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setUser(null); return; }
      setUser({ id: user.id, email: user.email ?? "" });
      resolveUser(supabase, user.id, user.email ?? "").then(setUser);
    });

    // Keep in sync as auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        if (!u) { setUser(null); return; }
        setUser({ id: u.id, email: u.email ?? "" });
        resolveUser(supabase, u.id, u.email ?? "").then(setUser);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  return <>{children}</>;
}
