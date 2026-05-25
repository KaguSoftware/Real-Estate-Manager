// Resolves a Google Maps short-link to its long-form URL. Browsers can't follow
// these redirects cross-origin, so we do it server-side here.

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

export async function GET(req: NextRequest) {
	const raw = req.nextUrl.searchParams.get("url");
	if (!raw) {
		return NextResponse.json({ error: "Missing ?url" }, { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
	}

	if (!ALLOWED_HOSTS.has(parsed.hostname)) {
		return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
	}

	try {
		const res = await fetch(parsed.toString(), {
			redirect: "follow",
			// User-Agent matters: some Google endpoints respond differently to
			// "node-fetch"-style clients and may return interstitial pages.
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; RealEstateManager/1.0; +https://example.com)",
			},
		});
		return NextResponse.json({ finalUrl: res.url });
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "Resolve failed" },
			{ status: 502 },
		);
	}
}
