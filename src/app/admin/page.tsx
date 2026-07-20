/**
 * /admin — Server Component page with a server-side auth + role guard.
 *
 * The guard runs on the server before any HTML is sent to the client:
 *  1. If no session → redirect to /
 *  2. If session but app_role !== 'admin' → redirect to /
 *
 * This is the only reliable guard — never rely on client-side checks for
 * route protection, as they can be bypassed by disabling JS.
 */

import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { AdminPanel } from "@/src/components/admin/AdminPanel";

export default async function AdminPage() {
  const supabase = await createClient();

  // Check session. getUserId() verifies the JWT signature locally rather than
  // calling the auth server — the token is cryptographically verified, so it is
  // just as trustworthy here as getUser() was, without the round-trip.
  const userId = await getUserId(supabase);

  if (!userId) {
    redirect("/");
  }

  // Check admin role — query profiles table server-side (bypasses RLS via server client)
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .single();

  if (!profile || profile.app_role !== "admin") {
    redirect("/");
  }

  return <AdminPanel />;
}
