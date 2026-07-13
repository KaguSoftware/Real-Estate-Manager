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
	/** Path inside the team-logos bucket, or null when no logo uploaded. */
	logo_path: string | null;
	/** User-picked document colors (hex, e.g. "#1e242e") — main brand color
	 *  plus two accents. The 5 PDF roles are derived in src/lib/pdf/branding.ts. */
	brand_color_main: string;
	brand_color_accent1: string;
	brand_color_accent2: string;
	/** How many people the team said they are (onboarding); informational only. */
	size_bracket: TeamSizeBracket | null;
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
	if (!team) throw new Error("Ekibiniz yok — önce bir ekibe katılın veya ekip oluşturun");
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

// Single-flight: sign-in triggers this from AuthForm AND AuthProvider's
// auth-state listener at once; sharing one promise avoids duplicate round
// trips and the transient team-null flicker between them.
let inFlightTeamContext: Promise<TeamContext | null> | null = null;

/** Full team context for the signed-in user, or null when they have no team. */
export function fetchTeamContext(): Promise<TeamContext | null> {
	if (!inFlightTeamContext) {
		inFlightTeamContext = fetchTeamContextUncached().finally(() => {
			inFlightTeamContext = null;
		});
	}
	return inFlightTeamContext;
}

async function fetchTeamContextUncached(): Promise<TeamContext | null> {
	const { supabase, user } = await requireUser();
	// MUST filter by user_id: the team_members RLS policy lets a member read the
	// WHOLE roster, so an unfiltered .maybeSingle() throws PGRST116 ("multiple
	// rows") the moment the team has 2+ members.
	const { data, error } = await supabase
		.from("team_members")
		.select("role, teams(id, name, trial_ends_at, size_bracket, logo_path, brand_color_main, brand_color_accent1, brand_color_accent2, subscriptions(status, plan_id, current_period_end))")
		.eq("user_id", user.id)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	// One-team-per-user makes both joins single rows, but PostgREST types them loosely.
	const teamRaw = data.teams as unknown;
	const team = (Array.isArray(teamRaw) ? teamRaw[0] : teamRaw) as {
		id: string;
		name: string;
		trial_ends_at: string;
		size_bracket: TeamSizeBracket | null;
		logo_path: string | null;
		brand_color_main: string | null;
		brand_color_accent1: string | null;
		brand_color_accent2: string | null;
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
		logo_path: team.logo_path ?? null,
		brand_color_main: team.brand_color_main ?? "#1e242e",
		brand_color_accent1: team.brand_color_accent1 ?? "#b74427",
		brand_color_accent2: team.brand_color_accent2 ?? "#8b929e",
		size_bracket: team.size_bracket ?? null,
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

/** Accept either a bare invite code or a full join link. Invite codes are
 *  base64url ([A-Za-z0-9_-], never '/'), so anything containing '/join/' or
 *  parsing as a URL is a pasted link — pull the code out of it. */
export function normalizeInviteCode(input: string): string {
	const trimmed = input.trim();
	const marker = "/join/";
	const at = trimmed.indexOf(marker);
	if (at !== -1) {
		return trimmed.slice(at + marker.length).split(/[?#/]/)[0];
	}
	try {
		const segments = new URL(trimmed).pathname.split("/").filter(Boolean);
		if (segments.length > 0) return segments[segments.length - 1];
	} catch {
		// Not a URL — treat as a bare code.
	}
	return trimmed;
}

export async function acceptInvite(code: string): Promise<string> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("accept_invite", { invite_code: normalizeInviteCode(code) });
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

/** Owner-only (RPC). Demotes the caller to agent and promotes the member. */
export async function transferOwnership(newOwnerId: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.rpc("transfer_ownership", { new_owner: newOwnerId });
	if (error) throw error;
}

/** Agent-only (RPC) — owners must transfer or delete first. */
export async function leaveTeam(): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.rpc("leave_team");
	if (error) throw error;
}

/** Owner-only, irreversible: cascades every table, then storage cleanup.
 *  Goes through /api/team/delete because storage removal needs the service
 *  role (the delete_team RPC can't touch storage.objects — migration 0016). */
export async function deleteTeam(): Promise<void> {
	const res = await fetch("/api/team/delete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ confirmation: "DELETE" }),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(json?.error || "Ekip silinemedi");
	}
}

/** Owner-only (RLS + guard trigger allow non-sensitive team fields). Updates the
 *  informational group-size bracket set at onboarding. */
export async function updateTeamSize(sizeBracket: TeamSizeBracket): Promise<void> {
	const { supabase } = await requireUser();
	const teamId = requireTeamId();
	const { error } = await supabase.from("teams").update({ size_bracket: sizeBracket }).eq("id", teamId);
	if (error) throw error;
}

export async function renameTeam(name: string): Promise<void> {
	const { supabase } = await requireUser();
	const teamId = requireTeamId();
	const { error } = await supabase.from("teams").update({ name }).eq("id", teamId);
	if (error) throw error;
}

// ── Branding ─────────────────────────────────────────────────────────────────

const LOGO_BUCKET = "team-logos";
const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB
// PNG/JPEG only — react-pdf's <Image> cannot render WebP/SVG.
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

/** Public CDN URL for a stored logo. Paths are timestamped on upload, so the
 *  URL changes on every re-upload and no cache busting param is needed. */
export function getTeamLogoUrl(logoPath: string | null): string | null {
	if (!logoPath) return null;
	const { data } = createClient().storage.from(LOGO_BUCKET).getPublicUrl(logoPath);
	return data.publicUrl;
}

/** Storage failures come back as generic messages; translate the three real
 *  failure classes into something the owner can act on. */
function mapLogoUploadError(e: unknown): Error {
	const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
	if (/bucket not found/i.test(raw)) {
		return new Error(
			"Depolama alanı bulunamadı — sistem yöneticinizin 0012_team_branding.sql migrasyonunu uygulaması gerekiyor.",
		);
	}
	if (/row-level security|violates.*policy|unauthorized|403/i.test(raw)) {
		const team = useAppStore.getState().team;
		if (team && !team.is_writable) {
			return new Error(
				"Deneme süreniz sona erdi — logo yüklemek için aboneliğinizi etkinleştirin.",
			);
		}
		return new Error(
			"Logo yükleme izni reddedildi. Yalnızca ekip sahibi logo yükleyebilir; sorun devam ederse oturumu kapatıp tekrar açın.",
		);
	}
	if (/payload too large|exceeded|maximum allowed size/i.test(raw)) {
		return new Error("Dosya çok büyük — logo 1 MB'den küçük olmalı.");
	}
	return e instanceof Error ? e : new Error(raw);
}

/** Owner-only (RLS). Compresses the image client-side, uploads it as
 *  {team_id}/logo-{ts}.{ext} and points teams.logo_path at it. */
export async function uploadTeamLogo(file: File): Promise<string> {
	const ext = LOGO_TYPES[file.type];
	if (!ext) throw new Error("Logo PNG veya JPEG formatında olmalı.");
	const { supabase } = await requireUser();
	const teamId = requireTeamId();

	// Downscale/compress before upload: the logo renders at ≤128px in the navbar
	// and small in PDFs, and phone-camera images easily exceed the 1 MB cap.
	let payload: Blob = file;
	if (file.size > 200 * 1024) {
		try {
			const imageCompression = (await import("browser-image-compression")).default;
			payload = await imageCompression(file, {
				maxSizeMB: 0.5,
				maxWidthOrHeight: 1024,
				useWebWorker: true,
				fileType: file.type,
			});
		} catch {
			// Best-effort: fall through with the original file; the size check below
			// still guards the bucket cap.
		}
	}
	if (payload.size > LOGO_MAX_BYTES) throw new Error("Dosya çok büyük — logo 1 MB'den küçük olmalı.");

	// Timestamped filename: a stable path would serve stale CDN copies after
	// re-upload. NO upsert — the path can never collide, and x-upsert makes
	// storage demand the UPDATE policy on top of INSERT (a plain insert only
	// needs the INSERT policy). This exact flag was why uploads failed with
	// "no permission" on databases missing the team_logos UPDATE policy.
	const path = `${teamId}/logo-${Date.now()}.${ext}`;
	const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, payload, {
		cacheControl: "3600",
		contentType: file.type,
	});
	if (upErr) throw mapLogoUploadError(upErr);
	const { error } = await supabase.from("teams").update({ logo_path: path }).eq("id", teamId);
	if (error) throw error;
	return path;
}

export async function removeTeamLogo(logoPath: string): Promise<void> {
	const { supabase } = await requireUser();
	const teamId = requireTeamId();
	const { error } = await supabase.from("teams").update({ logo_path: null }).eq("id", teamId);
	if (error) throw error;
	// Best-effort cleanup; a dangling object is harmless.
	await supabase.storage.from(LOGO_BUCKET).remove([logoPath]).catch(() => {});
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Persist the three user-picked document colors (validated client-side;
 *  a DB CHECK constraint enforces the same hex shape). */
export async function updateTeamColors(main: string, accent1: string, accent2: string): Promise<void> {
	if (![main, accent1, accent2].every((c) => HEX_RE.test(c))) {
		throw new Error("Renkler #rrggbb biçiminde olmalı");
	}
	const { supabase } = await requireUser();
	const teamId = requireTeamId();
	const { error } = await supabase
		.from("teams")
		.update({
			brand_color_main: main.toLowerCase(),
			brand_color_accent1: accent1.toLowerCase(),
			brand_color_accent2: accent2.toLowerCase(),
		})
		.eq("id", teamId);
	if (error) throw error;
}
