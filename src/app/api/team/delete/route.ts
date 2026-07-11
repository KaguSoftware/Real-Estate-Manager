/**
 * POST /api/team/delete — owner-only, irreversible team deletion.
 *
 * The delete_team() RPC removes the database rows (everything cascades from
 * teams) but cannot touch storage.objects — on hosted Supabase that table is
 * owned by supabase_storage_admin, not the postgres role that owns the
 * function (see migration 0016). So the RPC runs first, then this route
 * removes the team's files from all three buckets through the storage API
 * with the service role. Storage cleanup is best-effort: the team data is
 * already gone, so a failure here is logged rather than surfaced.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/server";
import { isRateLimited } from "@/src/lib/rateLimit";

const TEAM_BUCKETS = ["property-images", "documents", "team-logos"] as const;

/** All object paths under `prefix/` in a bucket (storage list() is per-folder,
 *  so walk sub-folders; entries without an id are folders). */
async function listAllPaths(
	service: SupabaseClient,
	bucket: string,
	prefix: string,
): Promise<string[]> {
	const paths: string[] = [];
	const folders = [prefix];
	while (folders.length > 0) {
		const folder = folders.pop()!;
		for (let offset = 0; ; offset += 100) {
			const { data, error } = await service.storage
				.from(bucket)
				.list(folder, { limit: 100, offset });
			if (error || !data || data.length === 0) break;
			for (const entry of data) {
				if (entry.id) paths.push(`${folder}/${entry.name}`);
				else folders.push(`${folder}/${entry.name}`);
			}
			if (data.length < 100) break;
		}
	}
	return paths;
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (await isRateLimited(`team-delete:${user.id}`, 5, 3_600_000)) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const body = (await request.json().catch(() => null)) as { confirmation?: string } | null;
	if (body?.confirmation !== "DELETE") {
		return NextResponse.json({ error: "confirmation required" }, { status: 400 });
	}

	// Capture the team id before the RPC removes the membership row.
	const { data: membership } = await supabase
		.from("team_members")
		.select("team_id, role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (!membership || membership.role !== "owner") {
		return NextResponse.json(
			{ error: "Yalnızca ekip sahibi ekibi silebilir." },
			{ status: 403 },
		);
	}

	// Runs as the caller: re-checks ownership + confirmation, cascades all rows.
	const { error: rpcErr } = await supabase.rpc("delete_team", { confirmation: "DELETE" });
	if (rpcErr) {
		console.error("delete_team RPC failed", rpcErr);
		return NextResponse.json({ error: "Ekip silinemedi — lütfen tekrar deneyin." }, { status: 500 });
	}

	const service = createServiceClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	for (const bucket of TEAM_BUCKETS) {
		try {
			const paths = await listAllPaths(service, bucket, membership.team_id);
			if (paths.length > 0) {
				const { error } = await service.storage.from(bucket).remove(paths);
				if (error) throw error;
			}
		} catch (err) {
			console.error(`storage cleanup failed for ${bucket}/${membership.team_id}`, err);
		}
	}

	return NextResponse.json({ ok: true });
}
