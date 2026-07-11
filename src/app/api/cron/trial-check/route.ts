/**
 * GET /api/cron/trial-check — daily Vercel cron (vercel.json). Sweeps every
 * team via run_trial_checks() (migration 0015) so owners get trial-ending /
 * trial-ended notifications even if they never open the app.
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
	return NextResponse.json({ ok: true, teamsChecked: data ?? 0 });
}
