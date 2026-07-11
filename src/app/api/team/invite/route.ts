/**
 * POST /api/team/invite { email } — owner-only email invite.
 *
 * Creates an invite row (RLS: only the team owner can insert), then emails the
 * invitee via the service-role admin API with a redirect to /join/[code].
 * Existing accounts can't be re-invited through inviteUserByEmail, so for them
 * we return the join link for the owner to share directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Simple in-memory rate limit: max 20 invites per user per hour per instance.
const sent = new Map<string, { count: number; reset: number }>();
function rateLimited(userId: string): boolean {
	const now = Date.now();
	const entry = sent.get(userId);
	if (!entry || entry.reset < now) {
		sent.set(userId, { count: 1, reset: now + 3_600_000 });
		return false;
	}
	entry.count += 1;
	return entry.count > 20;
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { email?: string } | null;
	const email = body?.email?.trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
	}
	if (rateLimited(user.id)) {
		return NextResponse.json({ error: "Too many invites — try again later" }, { status: 429 });
	}

	// Insert through the user's own client: RLS guarantees only a team owner
	// can create invites, so no separate role check is needed here.
	const { data: teamId } = await supabase.rpc("user_team_id");
	if (!teamId) return NextResponse.json({ error: "No team" }, { status: 403 });

	const { data: invite, error: invErr } = await supabase
		.from("invites")
		.insert({ team_id: teamId, email, created_by: user.id })
		.select("code")
		.single();
	if (invErr) {
		const status = invErr.code === "42501" ? 403 : 500;
		return NextResponse.json(
			{ error: status === 403 ? "Only the team owner can invite" : invErr.message },
			{ status },
		);
	}

	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
	const joinUrl = `${siteUrl}/join/${invite.code}`;

	const service = createServiceClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	const { error: mailErr } = await service.auth.admin.inviteUserByEmail(email, {
		redirectTo: joinUrl,
	});

	// Existing users can't receive a signup invite email — hand the owner the
	// link so they can send it themselves (WhatsApp etc. is common here).
	if (mailErr) {
		return NextResponse.json({ ok: true, emailed: false, joinUrl });
	}
	return NextResponse.json({ ok: true, emailed: true, joinUrl });
}
