// In-app notifications (migration 0011). Rows are created only by DB
// triggers / SECURITY DEFINER RPCs — the client can just read and mark read.

import { createClient } from "@/src/lib/supabase/client";

export type NotificationType =
	| "trial_started"
	| "invite_accepted"
	| "member_joined"
	| "trial_ending"
	| "trial_ended"
	| "subscription_activated"
	| "team_invite";

export interface AppNotification {
	id: string;
	type: NotificationType;
	title: string;
	body: string | null;
	/** Optional deep link (e.g. the /join/[code] URL of a team invite). */
	href: string | null;
	read_at: string | null;
	created_at: string;
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from("notifications")
		.select("id, type, title, body, href, read_at, created_at")
		.order("created_at", { ascending: false })
		.limit(limit);
	if (error) throw error;
	return (data ?? []) as AppNotification[];
}

export async function unreadNotificationCount(): Promise<number> {
	const supabase = createClient();
	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.is("read_at", null);
	if (error) throw error;
	return count ?? 0;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const supabase = createClient();
	const { error } = await supabase
		.from("notifications")
		.update({ read_at: new Date().toISOString() })
		.in("id", ids)
		.is("read_at", null);
	if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
	const supabase = createClient();
	const { error } = await supabase
		.from("notifications")
		.update({ read_at: new Date().toISOString() })
		.is("read_at", null);
	if (error) throw error;
}

/**
 * Idempotent server-side check that inserts trial_ending / trial_ended
 * notifications when due. Fire-and-forget on app load; failures are
 * non-fatal (the TrialBanner still shows trial state).
 */
export async function checkTrialNotifications(): Promise<void> {
	const supabase = createClient();
	await supabase.rpc("check_trial_notifications");
}
