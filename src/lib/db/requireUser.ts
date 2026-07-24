import { createClient } from "@/src/lib/supabase/client";

/**
 * The signed-in user for a browser-side data call, plus a Supabase client.
 *
 * Uses `getSession()`, which reads the locally-cached session — NOT `getUser()`,
 * which is a network round-trip to the Supabase auth server (~300ms) paid on
 * every list/CRUD call just to confirm somebody is signed in. On a dashboard
 * that fires five parallel reads, that was five wasted round-trips.
 *
 * This establishes identity for convenience only (to stamp `created_by`, to
 * scope a query). **RLS remains the authority** on what may actually be read or
 * written, which is what makes the local read safe: a tampered client-side
 * session still cannot get past the database's policies.
 *
 * This used to be copy-pasted into thirteen `src/lib/db/*` modules, which had
 * already drifted — six were local, seven still paid the round-trip. Keep it in
 * one place so it cannot drift again.
 */
export async function requireUser() {
	const supabase = createClient();
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error || !session?.user) throw new Error("Not authenticated");
	return { supabase, user: session.user };
}
