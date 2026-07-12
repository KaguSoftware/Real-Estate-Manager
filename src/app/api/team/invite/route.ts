/**
 * POST /api/team/invite { email } — owner-only email invite.
 *
 * Creates an invite row (RLS: only the team owner can insert), then delivers it:
 *  - new address → Supabase auth invite email (signup + redirect to /join/[code])
 *  - existing account → in-app team_invite notification + Resend email; the
 *    join link is still returned so the owner can share it manually too.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/src/lib/rateLimit";
import { sendTeamInviteEmail } from "@/src/lib/email";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { email?: string } | null;
	const email = body?.email?.trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
	}
	// Max 20 invites per user per hour (distributed when Upstash is configured).
	if (await isRateLimited(`invite:${user.id}`, 20, 3_600_000)) {
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
	if (!mailErr) return NextResponse.json({ ok: true, emailed: true, joinUrl });

	// inviteUserByEmail rejects addresses that already have an account. Reach
	// those users directly: in-app notification (+ Resend email when configured).
	const { data: existing } = await service
		.from("profiles")
		.select("id")
		.eq("email", email)
		.maybeSingle();
	if (!existing) {
		// Not an existing user either — the auth invite failed for another
		// reason (SMTP etc.). Fall back to the shareable link.
		return NextResponse.json({ ok: true, emailed: false, joinUrl });
	}

	const [{ data: teamRow }, { data: inviterRow }] = await Promise.all([
		service.from("teams").select("name").eq("id", teamId).single(),
		service.from("profiles").select("full_name, display_name").eq("id", user.id).single(),
	]);
	const teamName = teamRow?.name ?? "Kagu";
	const inviterName = inviterRow?.full_name || inviterRow?.display_name || null;

	const { error: notifErr } = await service.from("notifications").insert({
		user_id: existing.id,
		team_id: teamId,
		type: "team_invite",
		title: `${teamName} ekibine davet edildiniz`,
		body: inviterName
			? `${inviterName} sizi ${teamName} ekibine danışman olarak davet etti.`
			: `${teamName} ekibine danışman olarak davet edildiniz.`,
		href: joinUrl,
	});

	const emailResult = await sendTeamInviteEmail({ to: email, teamName, inviterName, joinUrl });

	return NextResponse.json({
		ok: true,
		emailed: emailResult.sent,
		notified: !notifErr,
		joinUrl,
	});
}
