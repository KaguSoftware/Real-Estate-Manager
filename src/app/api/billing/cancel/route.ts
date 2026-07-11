/**
 * POST /api/billing/cancel — owner-only self-service cancellation.
 *
 * Real providers confirm the cancellation asynchronously via their webhook
 * (subscription_canceled), so this route only *requests* it. The mock provider
 * has no webhook of its own; its cancellation reuses the existing mock
 * checkout flow — we return the same kind of webhook URL the mock checkout
 * uses, with type=subscription_canceled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getPaymentProvider } from "@/src/lib/billing";
import { isRateLimited } from "@/src/lib/rateLimit";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { data: teamId } = await supabase.rpc("user_team_id");
	if (!teamId) return NextResponse.json({ error: "No team" }, { status: 403 });
	if (await isRateLimited(`billing-cancel:${teamId}`, 5, 60_000)) {
		return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
	}
	const { data: isOwner } = await supabase.rpc("is_team_owner", { t: teamId });
	if (!isOwner) {
		return NextResponse.json(
			{ error: "Aboneliği yalnızca ekip sahibi yönetebilir" },
			{ status: 403 },
		);
	}

	// RLS scopes this select to the caller's own team.
	const { data: sub } = await supabase
		.from("subscriptions")
		.select("status, provider_subscription_id")
		.eq("team_id", teamId)
		.maybeSingle();
	if (!sub || (sub.status !== "active" && sub.status !== "past_due")) {
		return NextResponse.json({ error: "İptal edilecek etkin bir abonelik yok" }, { status: 400 });
	}

	const provider = getPaymentProvider();

	// Mock (dev only): drive the state change through the normal webhook flow.
	if (provider.name === "mock") {
		const url = new URL("/api/billing/webhook", request.nextUrl.origin);
		url.searchParams.set("mock", "1");
		url.searchParams.set("team_id", teamId);
		url.searchParams.set("type", "subscription_canceled");
		url.searchParams.set("return_to", "/settings/billing?canceled=1");
		return NextResponse.json({ url: url.toString() });
	}

	if (!sub.provider_subscription_id) {
		return NextResponse.json({ error: "İptal edilecek etkin bir abonelik yok" }, { status: 400 });
	}

	try {
		await provider.cancelSubscription(sub.provider_subscription_id);
		// Status flips to "canceled" when the provider's webhook lands; write
		// access continues until the already-paid period ends.
		return NextResponse.json({ ok: true });
	} catch {
		// iyzico is still a stub until the API keys arrive — fail honestly.
		return NextResponse.json(
			{ error: "İptal işlemi şu anda çevrimiçi yapılamıyor — lütfen destek ile iletişime geçin." },
			{ status: 501 },
		);
	}
}
