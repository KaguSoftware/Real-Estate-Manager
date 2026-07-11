/**
 * Billing webhook — provider-agnostic. Flow:
 *   1. verifyWebhook() authenticates + normalizes (throws on bad signature → 400)
 *   2. idempotency: INSERT provider_event_id into billing_events; on conflict
 *      the event was already applied → 200 without reprocessing
 *   3. apply the state machine to public.subscriptions with the service role
 *
 * State machine:
 *   trialing/past_due/canceled + payment_succeeded → active (period end set)
 *   active + payment_failed                        → past_due (7-day RLS grace)
 *   any + subscription_canceled                    → canceled
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getPaymentProvider, type NormalizedEvent } from "@/src/lib/billing";

function service() {
	return createServiceClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
}

async function applyEvent(event: NormalizedEvent, providerName: string): Promise<void> {
	const db = service();

	// Idempotency ledger — replayed events are no-ops.
	const { error: ledgerErr } = await db.from("billing_events").insert({
		provider_event_id: event.providerEventId,
		team_id: event.teamId,
		type: event.type,
		payload: JSON.parse(JSON.stringify(event.raw ?? {})),
	});
	if (ledgerErr) {
		if (ledgerErr.code === "23505") return; // duplicate → already processed
		throw ledgerErr;
	}

	const patch: Record<string, unknown> = { provider: providerName };
	switch (event.type) {
		case "payment_succeeded":
			patch.status = "active";
			patch.current_period_end = event.periodEnd ?? null;
			if (event.planId) patch.plan_id = event.planId;
			if (event.providerSubscriptionId) {
				patch.provider_subscription_id = event.providerSubscriptionId;
			}
			break;
		case "payment_failed": {
			patch.status = "past_due";
			// team_is_writable grants past_due teams current_period_end + 7 days.
			// A renewal failure arrives when current_period_end ≈ now, so leaving it
			// untouched would collapse the advertised grace to zero — float it to
			// now() (never backwards) so the 7 days actually run from the failure.
			const { data: sub } = await db
				.from("subscriptions")
				.select("current_period_end")
				.eq("team_id", event.teamId)
				.maybeSingle();
			const existing = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
			if (existing < Date.now()) {
				patch.current_period_end = new Date().toISOString();
			}
			break;
		}
		case "subscription_canceled":
			patch.status = "canceled";
			break;
	}

	const { error } = await db.from("subscriptions").update(patch).eq("team_id", event.teamId);
	if (error) throw error;
}

async function handle(request: NextRequest): Promise<NextResponse> {
	const provider = getPaymentProvider();

	let event: NormalizedEvent;
	try {
		event = await provider.verifyWebhook(request);
	} catch {
		return NextResponse.json({ error: "invalid webhook" }, { status: 400 });
	}

	try {
		await applyEvent(event, provider.name);
	} catch (e) {
		// Non-200 → provider retries; idempotency ledger makes retries safe.
		console.error("billing webhook failed", e);
		return NextResponse.json({ error: "processing failed" }, { status: 500 });
	}

	// Mock-provider "checkout" arrives as a browser GET — bounce back to the app.
	// Only same-origin relative paths are allowed, never an absolute URL, so this
	// cannot be turned into an open redirect.
	if (request.method === "GET") {
		const returnTo = request.nextUrl.searchParams.get("return_to");
		const safePath = returnTo && /^\/(?!\/)/.test(returnTo) ? returnTo : "/settings/billing";
		return NextResponse.redirect(new URL(safePath, request.nextUrl.origin)) as unknown as NextResponse;
	}
	return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
	return handle(request);
}

// GET exists solely for the mock provider's redirect-based flow.
export async function GET(request: NextRequest) {
	if (getPaymentProvider().name !== "mock") {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	return handle(request);
}
