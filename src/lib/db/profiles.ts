// Profile + admin helpers. Moved from the deleted documents.ts.
// All calls are gated by Supabase RLS on the `profiles` table.

import { createClient } from "@/src/lib/supabase/client";
import type { ProfileRow, GlobalRole } from "./types";
import { requireUser } from "./requireUser";

export async function getMyProfile(): Promise<ProfileRow | null> {
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const user = session?.user;
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
	const { supabase, user } = await requireUser();

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

// ── Profile pictures ─────────────────────────────────────────────────────────
// Mirrors the team-logo flow (src/lib/db/teams.ts): public bucket, client-side
// compression, timestamped path so CDN caches never go stale.

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 1024 * 1024; // 1 MB
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

/** Public CDN URL for a stored avatar, or null. */
export function getAvatarUrl(avatarPath: string | null): string | null {
	if (!avatarPath) return null;
	const { data } = createClient().storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
	return data.publicUrl;
}

/** Self-only (RLS). Compresses client-side, uploads {user_id}/avatar-{ts}.{ext}
 *  and points profiles.avatar_path at it. Returns the new path. */
export async function uploadMyAvatar(file: File): Promise<string> {
	const ext = AVATAR_TYPES[file.type];
	if (!ext) throw new Error("Profil fotoğrafı PNG veya JPEG formatında olmalı.");
	const { supabase, user } = await requireUser();

	// Avatars render at ≤64px; downscale phone-camera images before upload.
	let payload: Blob = file;
	if (file.size > 200 * 1024) {
		try {
			const imageCompression = (await import("browser-image-compression")).default;
			payload = await imageCompression(file, {
				maxSizeMB: 0.3,
				maxWidthOrHeight: 512,
				useWebWorker: true,
				fileType: file.type,
			});
		} catch {
			// Best-effort; the size cap below still guards the bucket.
		}
	}
	if (payload.size > AVATAR_MAX_BYTES) throw new Error("Dosya çok büyük — fotoğraf 1 MB'den küçük olmalı.");

	const oldPath = (await getMyProfile())?.avatar_path ?? null;
	const path = `${user.id}/avatar-${Date.now()}.${ext}`;
	const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, payload, {
		cacheControl: "3600",
		contentType: file.type,
	});
	if (upErr) throw upErr;
	const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
	if (error) throw error;
	// Best-effort cleanup of the previous object; a dangling copy is harmless.
	if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => {});
	return path;
}

export async function removeMyAvatar(avatarPath: string): Promise<void> {
	const { supabase, user } = await requireUser();
	const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
	if (error) throw error;
	await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]).catch(() => {});
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
