// Server-side geocoding endpoint. Nominatim policy requires an identifying
// User-Agent, which browsers can't set — so the client always goes through here.
//
//   GET /api/geocode?lat=..&lon=..            → reverse: { address }
//   GET /api/geocode?q=..&mahalle=..&city=..  → forward: { lat, lon }
//
// Rate limiting (1 req/s) is handled by the shared chain in lib/geocode.

import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress, reverseGeocode } from "@/src/lib/geocode";
import { isRateLimited, clientIp } from "@/src/lib/rateLimit";

export async function GET(req: NextRequest) {
	// Per-IP abuse limit (30/min) on top of the upstream 1 req/s politeness throttle.
	if (await isRateLimited(`geocode:${clientIp(req)}`, 30, 60_000)) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}
	const p = req.nextUrl.searchParams;

	const latRaw = p.get("lat");
	const lonRaw = p.get("lon");
	if (latRaw != null && lonRaw != null) {
		const lat = Number(latRaw);
		const lon = Number(lonRaw);
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
			return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
		}
		const address = await reverseGeocode(lat, lon);
		return NextResponse.json({ address: address ?? null });
	}

	const q = p.get("q");
	if (q != null) {
		const result = await geocodeAddress({
			address_line: q,
			mahalle: p.get("mahalle"),
			mevkii: p.get("mevkii"),
			city: p.get("city"),
		});
		return NextResponse.json(result ?? { error: "Address not found" }, {
			status: result ? 200 : 404,
		});
	}

	return NextResponse.json({ error: "Pass lat&lon (reverse) or q (forward)" }, { status: 400 });
}
