// Team context, roster, invites and subscription state. Team creation /
// invite acceptance / member removal go through SECURITY DEFINER RPCs
// (migration 0010) — never direct table writes.

import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";

export interface TeamContext {
	id: string;
	name: string;
	role: "owner" | "agent";
	trial_ends_at: string;
	subscription_status: "trialing" | "active" | "past_due" | "canceled" | null;
	plan_id: string | null;
	current_period_end: string | null;
	/** Mirror of the DB-side team_is_writable() check; RLS is authoritative. */
	is_writable: boolean;
}

export interface TeamMember {
	user_id: string;
	role: "owner" | "agent";
	display_name: string | null;
	email: string;
}

export interface Invite {
	id: string;
	email: string | null;
	code: string;
	expires_at: string;
	accepted_at: string | null;
	revoked_at: string | null;
	created_at: string;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { session }, error } = await supabase.auth.getSession();
	if (error || !session?.user) throw new Error("Not authenticated");
	return { supabase, user: session.user };
}

/** The signed-in user's team id, from the store. Throws before a bad insert
 *  can reach the database with a missing/foreign team_id. */
export function requireTeamId(): string {
	const team = useAppStore.getState().team;
	if (!team) throw new Error("No team — join or create a team first");
	return team.id;
}

const GRACE_DAYS = 7;

export function computeIsWritable(
	trialEndsAt: string,
	status: TeamContext["subscription_status"],
	currentPeriodEnd: string | null,
): boolean {
	if (new Date(trialEndsAt).getTime() > Date.now()) return true;
	if (status === "active") return true;
	if (status === "past_due" && currentPeriodEnd) {
		return new Date(currentPeriodEnd).getTime() + GRACE_DAYS * 86_400_000 > Date.now();
	}
	return false;
}

/** Full team context for the signed-in user, or null when they have no team. */
export async function fetchTeamContext(): Promise<TeamContext | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("team_members")
		.select("role, teams(id, name, trial_ends_at, subscriptions(status, plan_id, current_period_end))")
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	// One-team-per-user makes both joins single rows, but PostgREST types them loosely.
	const teamRaw = data.teams as unknown;
	const team = (Array.isArray(teamRaw) ? teamRaw[0] : teamRaw) as {
		id: string;
		name: string;
		trial_ends_at: string;
		subscriptions:
			| { status: TeamContext["subscription_status"]; plan_id: string | null; current_period_end: string | null }
			| { status: TeamContext["subscription_status"]; plan_id: string | null; current_period_end: string | null }[]
			| null;
	} | null;
	if (!team) return null;
	const sub = Array.isArray(team.subscriptions) ? team.subscriptions[0] : team.subscriptions;

	return {
		id: team.id,
		name: team.name,
		role: data.role as "owner" | "agent",
		trial_ends_at: team.trial_ends_at,
		subscription_status: sub?.status ?? null,
		plan_id: sub?.plan_id ?? null,
		current_period_end: sub?.current_period_end ?? null,
		is_writable: computeIsWritable(team.trial_ends_at, sub?.status ?? null, sub?.current_period_end ?? null),
	};
}

export type TeamSizeBracket = "solo" | "2-5" | "6-20" | "20+";

export interface CreateTeamInput {
	name: string;
	sizeBracket?: TeamSizeBracket;
	city?: string;
	country?: string;
	referralSource?: string;
}

export async function createTeam(input: CreateTeamInput): Promise<string> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("create_team", {
		team_name: input.name,
		size_bracket: input.sizeBracket ?? null,
		city: input.city ?? null,
		country: input.country ?? null,
		referral_source: input.referralSource ?? null,
	});
	if (error) throw error;
	return data as string;
}

export async function acceptInvite(code: string): Promise<string> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("accept_invite", { invite_code: code });
	if (error) throw error;
	return data as string;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("team_members")
		.select("user_id, role, profiles:profiles!team_members_user_id_fkey(display_name, email)")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data ?? []).map((row) => {
		const pRaw = row.profiles as unknown;
		const p = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as { display_name: string | null; email: string } | null;
		return {
			user_id: row.user_id as string,
			role: row.role as "owner" | "agent",
			display_name: p?.display_name ?? null,
			email: p?.email ?? "",
		};
	});
}

/** Pending (not accepted/revoked/expired) invites — owner only per RLS. */
export async function listPendingInvites(): Promise<Invite[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("invites")
		.select("id, email, code, expires_at, accepted_at, revoked_at, created_at")
		.is("revoked_at", null)
		.is("accepted_at", null)
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: false });
	if (error) throw error;
	return (data ?? []) as Invite[];
}

export async function revokeInvite(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("invites")
		.update({ revoked_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
}

export async function rotateInviteLink(): Promise<string> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("rotate_invite_link");
	if (error) throw error;
	return data as string;
}

/** The current shareable link invite (email IS NULL), if one exists. */
export async function getActiveLinkInvite(): Promise<Invite | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("invites")
		.select("id, email, code, expires_at, accepted_at, revoked_at, created_at")
		.is("email", null)
		.is("revoked_at", null)
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return (data as Invite) ?? null;
}

export async function removeMember(userId: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.rpc("remove_member", { member_id: userId });
	if (error) throw error;
}

export async function renameTeam(name: string): Promise<void> {
	const { supabase } = await requireUser();
	const teamId = requireTeamId();
	const { error } = await supabase.from("teams").update({ name }).eq("id", teamId);
	if (error) throw error;
}
