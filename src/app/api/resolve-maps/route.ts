// Resolves a Google Maps link to coordinates + a structured address.
//
// Browsers can't follow Google's short-link redirects cross-origin, and Nominatim
// reverse geocoding must run server-side (policy User-Agent + no CORS), so this
// route does the whole job: expand short links (handling consent interstitials),
// extract coordinates from the resolved URL/body, then reverse-geocode them.

import { NextRequest, NextResponse } from "next/server";
import { parseLongMapsUrl } from "@/src/lib/maps-url";
import { reverseGeocode } from "@/src/lib/geocode";

// SSRF guard: only follow links to Google's own hosts. Includes long-URL hosts so
// already-expanded links can still round-trip here for reverse geocoding.
const ALLOWED_HOSTS = new Set([
	"maps.app.goo.gl", "goo.gl", "g.co",
	"google.com", "www.google.com",
	"maps.google.com", "maps.google.com.tr", "www.google.com.tr",
]);

const DESKTOP_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const COORD_RE = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;

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

	// Follow redirects and grab the final URL + a bounded slice of the body.
	let finalUrl = parsed.toString();
	let body = "";
	try {
		const res = await fetch(parsed.toString(), {
			redirect: "follow",
			headers: { "User-Agent": DESKTOP_UA },
		});
		finalUrl = res.url || finalUrl;
		// Coords / the real maps URL often live in the HTML even when finalUrl is a
		// consent page. Cap the read so we don't buffer megabytes.
		body = (await res.text()).slice(0, 200_000);
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "Resolve failed" },
			{ status: 502 },
		);
	}

	// Consent/interstitial: prefer the `continue=` target if present.
	try {
		const fu = new URL(finalUrl);
		if (fu.hostname.startsWith("consent.") || fu.pathname.includes("/consent")) {
			const cont = fu.searchParams.get("continue");
			if (cont) finalUrl = cont;
		}
	} catch {
		// finalUrl not a parseable URL — fall through to body scanning.
	}

	// Extract coordinates: try the resolved URL first, then the body, then a raw
	// !3d!4d scan of the body (covers embedded maps URLs / consent pages).
	let { lat, lon, placeName } = parseLongMapsUrl(finalUrl);
	if (lat == null || lon == null) {
		const fromBody = parseLongMapsUrl(body);
		lat = fromBody.lat;
		lon = fromBody.lon;
		placeName = placeName ?? fromBody.placeName;
	}
	if ((lat == null || lon == null) && body) {
		const m = COORD_RE.exec(body);
		if (m) {
			const blat = Number(m[1]);
			const blon = Number(m[2]);
			if (Number.isFinite(blat) && Number.isFinite(blon)) {
				lat = blat;
				lon = blon;
			}
		}
	}

	if (lat == null || lon == null) {
		// No coordinates anywhere. Still hand back placeName (if any) so the client
		// can text-autofill from the slug.
		return NextResponse.json(
			{ finalUrl, placeName, error: "No coordinates found in this link" },
			{ status: 200 },
		);
	}

	// Reverse-geocode for structured address parts. Partial success is fine: if it
	// fails we still return the pin.
	const address = await reverseGeocode(lat, lon);

	return NextResponse.json({
		finalUrl,
		lat,
		lon,
		placeName,
		address: address ?? undefined,
	});
}
