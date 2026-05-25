// Profile + admin helpers. Moved from the deleted documents.ts.
// All calls are gated by Supabase RLS on the `profiles` table.

import { createClient } from "@/src/lib/supabase/client";
import type { ProfileRow, GlobalRole } from "./types";

export async function getMyProfile(): Promise<ProfileRow | null> {
	const supabase = createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.single();

	if (error) return null;
	return data as ProfileRow;
}

/** Admin-only — RLS lets admins read every profile via profiles_select_own_or_admin. */
export async function adminListUsers(): Promise<ProfileRow[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data ?? []) as ProfileRow[];
}

/** Admin-only RPC — enforces is_admin() inside the SECURITY DEFINER function. */
export async function adminSetUserRole(params: {
	userId: string;
	role: GlobalRole;
}): Promise<void> {
	const supabase = createClient();
	const { error } = await supabase.rpc("admin_set_user_role", {
		target_user_id: params.userId,
		new_role: params.role,
	});
	if (error) throw error;
}
