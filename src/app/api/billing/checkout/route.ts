/** POST /api/billing/checkout { plan_id } — owner-only; returns { url }. */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getPaymentProvider } from "@/src/lib/billing";
import { isRateLimited } from "@/src/lib/rateLimit";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = (await request.json().catch(() => null)) as { plan_id?: string } | null;
	if (!body?.plan_id) return NextResponse.json({ error: "plan_id required" }, { status: 400 });

	const { data: teamId } = await supabase.rpc("user_team_id");
	if (!teamId) return NextResponse.json({ error: "No team" }, { status: 403 });
	// Per-team checkout cap (10/min) — cheap guard against accidental/abusive spamming.
	if (await isRateLimited(`checkout:${teamId}`, 10, 60_000)) {
		return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
	}
	const { data: isOwner } = await supabase.rpc("is_team_owner", { t: teamId });
	if (!isOwner) {
		return NextResponse.json({ error: "Only the team owner can manage billing" }, { status: 403 });
	}

	const { data: plan } = await supabase
		.from("plans").select("id").eq("id", body.plan_id).eq("is_active", true).maybeSingle();
	if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

	try {
		const { url } = await getPaymentProvider().createCheckout(teamId, plan.id, {
			returnUrl: `${siteUrl}/settings/billing?paid=1`,
		});
		return NextResponse.json({ url });
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "Checkout failed" },
			{ status: 500 },
		);
	}
}
