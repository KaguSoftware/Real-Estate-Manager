/**
 * /join/[code] — invite-link landing. Stores the code in a short-lived cookie
 * and forwards the visitor onward:
 *   - signed out → /signup, which shows "You've been invited to join <Team>"
 *   - signed in  → /onboarding, which auto-accepts the pending code
 * Works for both flows: email invites (auth.admin.inviteUserByEmail redirects
 * here) and the shareable team link.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ code: string }> },
) {
	const { code: rawCode } = await params;
	const code = rawCode.trim();

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	const url = request.nextUrl.clone();
	url.pathname = user ? "/onboarding" : "/signup";
	url.search = "";

	const res = NextResponse.redirect(url);
	res.cookies.set("kagu_pending_invite", code, {
		path: "/",
		maxAge: 60 * 60, // 1 hour — long enough to finish signup
		sameSite: "lax",
	});
	return res;
}
