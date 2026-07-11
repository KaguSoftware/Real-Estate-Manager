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

/** Onboarding wizard: name + phone on the caller's own profile (RLS: self-update only). */
export async function updateMyProfile(params: {
	fullName?: string;
	phone?: string;
}): Promise<void> {
	const supabase = createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");

	const patch: Record<string, string | null> = {};
	if (params.fullName !== undefined) {
		const name = params.fullName.trim();
		patch.full_name = name || null;
		// Keep the roster's display_name in sync when a real name is provided.
		if (name) patch.display_name = name;
	}
	if (params.phone !== undefined) patch.phone = params.phone.trim() || null;
	if (Object.keys(patch).length === 0) return;

	const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
	if (error) throw error;
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
