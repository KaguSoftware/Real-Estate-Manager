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
import { createClient } from "@/src/lib/supabase/server";
import { AdminPanel } from "@/src/components/admin/AdminPanel";

export default async function AdminPage() {
  const supabase = await createClient();

  // Check session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Check admin role — query profiles table server-side (bypasses RLS via server client)
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.app_role !== "admin") {
    redirect("/");
  }

  return <AdminPanel />;
}
