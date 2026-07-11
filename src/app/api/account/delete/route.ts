/**
 * POST /api/account/delete — self-service account erasure (KVKK md. 7/11).
 *
 * Owners must delete or transfer their team first (the teams.owner_id FK
 * blocks the delete at the DB level too — this route just fails friendlier).
 * Agents are removed from their team via leave_team(), then the auth user is
 * deleted with the service role; profiles + notifications cascade from it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/server";
import { isRateLimited } from "@/src/lib/rateLimit";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (await isRateLimited(`account-delete:${user.id}`, 3, 3_600_000)) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const body = (await request.json().catch(() => null)) as { confirmation?: string } | null;
	if (body?.confirmation !== "DELETE") {
		return NextResponse.json({ error: "confirmation required" }, { status: 400 });
	}

	// RLS scopes this to the caller's own membership row.
	const { data: membership } = await supabase
		.from("team_members")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (membership?.role === "owner") {
		return NextResponse.json(
			{ error: "Ekip sahibisiniz — hesabınızı silmeden önce ekibi silin veya sahipliği devredin." },
			{ status: 409 },
		);
	}

	if (membership) {
		const { error: leaveErr } = await supabase.rpc("leave_team");
		if (leaveErr) {
			return NextResponse.json({ error: "Ekipten ayrılma başarısız oldu" }, { status: 500 });
		}
	}

	const service = createServiceClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	const { error } = await service.auth.admin.deleteUser(user.id);
	if (error) {
		console.error("account delete failed", error);
		return NextResponse.json(
			{ error: "Hesap silinemedi — lütfen destek ile iletişime geçin." },
			{ status: 500 },
		);
	}
	return NextResponse.json({ ok: true });
}
