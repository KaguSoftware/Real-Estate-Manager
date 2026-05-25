// Parse Google Maps URLs to extract coordinates and a best-guess address.
//
// Short links (maps.app.goo.gl, goo.gl/maps) redirect to a long URL we can
// parse, but browsers can't follow that redirect cross-origin — so the
// /api/resolve-maps route handler does it server-side and hands us back the
// final URL.

export interface ParsedMapsUrl {
	lat?: number;
	lon?: number;
	placeName?: string;
}

export interface ResolveResult extends ParsedMapsUrl {
	error?: string;
}

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

export function isShortMapsUrl(url: string): boolean {
	try {
		const u = new URL(url);
		if (!SHORT_HOSTS.has(u.hostname)) return false;
		if (u.hostname === "goo.gl") return u.pathname.startsWith("/maps/");
		if (u.hostname === "g.co") return u.pathname.startsWith("/kgs/");
		return true;
	} catch {
		return false;
	}
}

function pickCoord(n: number, range: number): number | undefined {
	return Number.isFinite(n) && n >= -range && n <= range ? n : undefined;
}

export function parseLongMapsUrl(url: string): ParsedMapsUrl {
	const out: ParsedMapsUrl = {};

	// 1) !3dLAT!4dLNG — actual place coords, preferred.
	const m1 = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url);
	if (m1) {
		out.lat = pickCoord(Number(m1[1]), 90);
		out.lon = pickCoord(Number(m1[2]), 180);
	}

	// 2) @lat,lng,zoom — camera position, fallback.
	if (out.lat == null || out.lon == null) {
		const m2 = /@(-?\d+\.\d+),(-?\d+\.\d+)(?:,\d+(?:\.\d+)?z)?/.exec(url);
		if (m2) {
			out.lat = pickCoord(Number(m2[1]), 90);
			out.lon = pickCoord(Number(m2[2]), 180);
		}
	}

	// 3) q=/ll=/sll=/query=/destination=lat,lng — legacy share links.
	if (out.lat == null || out.lon == null) {
		const m3 = /[?&](?:q|ll|sll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(url);
		if (m3) {
			out.lat = pickCoord(Number(m3[1]), 90);
			out.lon = pickCoord(Number(m3[2]), 180);
		}
	}

	// 4) /maps/place/NAME — best-effort address string.
	const mp = /\/maps\/place\/([^/@?]+)/.exec(url);
	if (mp) {
		try {
			const decoded = decodeURIComponent(mp[1].replace(/\+/g, " "));
			if (decoded.trim()) out.placeName = decoded.trim();
		} catch {
			// ignore malformed % escapes
		}
	}

	return out;
}

export interface SplitPlaceName {
	street?: string;
	district?: string;
	city?: string;
	country?: string;
}

// Google formats place names as "Street, District, City, Country" — but the
// number of segments varies. Assign tail-first: last → country, then city,
// then district, then street. Best-effort.
export function splitPlaceName(name: string): SplitPlaceName {
	const parts = name.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
	const out: SplitPlaceName = {};
	if (parts.length === 0) return out;
	if (parts.length === 1) { out.street = parts[0]; return out; }
	out.country = parts[parts.length - 1];
	if (parts.length >= 2) out.city = parts[parts.length - 2];
	if (parts.length >= 3) out.district = parts[parts.length - 3];
	if (parts.length >= 4) out.street = parts.slice(0, parts.length - 3).join(", ");
	return out;
}

export async function resolveAndParseMapsUrl(url: string): Promise<ResolveResult> {
	const trimmed = url.trim();
	if (!trimmed) return { error: "Empty URL" };

	let target = trimmed;
	if (isShortMapsUrl(target)) {
		try {
			const res = await fetch(`/api/resolve-maps?url=${encodeURIComponent(target)}`);
			if (!res.ok) {
				return { error: `Could not resolve short link (${res.status})` };
			}
			const body = (await res.json()) as { finalUrl?: string; error?: string };
			if (body.error || !body.finalUrl) {
				return { error: body.error ?? "Resolver returned no URL" };
			}
			target = body.finalUrl;
		} catch (e) {
			return { error: e instanceof Error ? e.message : "Resolver request failed" };
		}
	}

	const parsed = parseLongMapsUrl(target);
	if (parsed.lat == null || parsed.lon == null) {
		// Still return any placeName we got — the caller can autofill text fields
		// even when coords are missing.
		return { ...parsed, error: "No coordinates found in this URL" };
	}
	return parsed;
}
