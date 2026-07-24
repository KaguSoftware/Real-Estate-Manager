/**
 * GET /api/cron/trial-check — the daily sweep (vercel.json, 06:00). Runs two
 * jobs so users are told what changed even if they never open the app:
 *   1. run_trial_checks()  (0015) — trial-ending / trial-ended, per team.
 *   2. run_work_checks()   (0029) — overdue rent, expiring leases, quiet
 *      leads, approaching project deliveries.
 * Route name kept for the existing vercel.json entry and cron history.
 *
 * Auth: Vercel sends "Authorization: Bearer ${CRON_SECRET}" when the env var
 * is set. Reject everything else so the route can't be triggered publicly.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const service = createServiceClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	const { data, error } = await service.rpc("run_trial_checks");
	if (error) {
		console.error("trial-check cron failed", error);
		return NextResponse.json({ error: "sweep failed" }, { status: 500 });
	}

	// Work notifications (0029): overdue rent, expiring leases, quiet leads,
	// approaching project deliveries. Each insert is guarded inside the function
	// so re-running the sweep never duplicates. A failure here must not fail the
	// trial sweep that already succeeded, so it's reported, not thrown.
	const { data: workCount, error: workError } = await service.rpc("run_work_checks");
	if (workError) console.error("work-check sweep failed", workError);

	return NextResponse.json({
		ok: true,
		teamsChecked: data ?? 0,
		workNotifications: workError ? null : (workCount ?? 0),
	});
}
