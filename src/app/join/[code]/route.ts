/**
 * /join/[code] — invite-link landing. Stores the code in a short-lived cookie
 * and forwards to /onboarding, which auto-accepts it once the visitor is
 * signed in (or right away if they already are). Works for both flows:
 * email invites (auth.admin.inviteUserByEmail redirects here) and the
 * shareable team link.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ code: string }> },
) {
	const { code } = await params;
	const url = request.nextUrl.clone();
	url.pathname = "/onboarding";
	url.search = "";

	const res = NextResponse.redirect(url);
	res.cookies.set("kagu_pending_invite", code, {
		path: "/",
		maxAge: 60 * 60, // 1 hour — long enough to finish signup
		sameSite: "lax",
	});
	return res;
}
