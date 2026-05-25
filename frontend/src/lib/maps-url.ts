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
	mahalle?: string;
	street?: string;
	buildingNo?: string;
	apartmentNo?: string;
	district?: string;
	city?: string;
	country?: string;
}

const TURKISH_STREET_TOKENS = /\b(Sk\.?|Sok\.?|Sokak|Cd\.?|Cad\.?|Cadde(?:si)?|Bul\.?|Bulvar(?:ı)?)\b/i;
const TURKISH_PROVINCES = new Set([
	"adana", "adıyaman", "afyonkarahisar", "ağrı", "amasya", "ankara", "antalya", "artvin",
	"aydın", "balıkesir", "bilecik", "bingöl", "bitlis", "bolu", "burdur", "bursa", "çanakkale",
	"çankırı", "çorum", "denizli", "diyarbakır", "edirne", "elazığ", "erzincan", "erzurum",
	"eskişehir", "gaziantep", "giresun", "gümüşhane", "hakkari", "hatay", "ısparta", "isparta",
	"mersin", "istanbul", "i̇stanbul", "izmir", "i̇zmir", "kars", "kastamonu", "kayseri",
	"kırklareli", "kırşehir", "kocaeli", "konya", "kütahya", "malatya", "manisa", "kahramanmaraş",
	"mardin", "muğla", "muş", "nevşehir", "niğde", "ordu", "rize", "sakarya", "samsun", "siirt",
	"sinop", "sivas", "tekirdağ", "tokat", "trabzon", "tunceli", "şanlıurfa", "uşak", "van",
	"yozgat", "zonguldak", "aksaray", "bayburt", "karaman", "kırıkkale", "batman", "şırnak",
	"bartın", "ardahan", "ığdır", "yalova", "karabük", "kilis", "osmaniye", "düzce",
]);

function stripLeadingZip(s: string): string {
	// "34260 Sultangazi" → "Sultangazi". Turkish ZIPs are 5 digits.
	return s.replace(/^\d{4,6}\s+/, "").trim();
}

function extractDoorNumbers(seg: string): { rest: string; buildingNo?: string; apartmentNo?: string } {
	let rest = seg;
	let buildingNo: string | undefined;
	let apartmentNo: string | undefined;

	// "No:34" / "No. 34" / "no:34/5" — common Turkish notation. Allow the unit
	// part to optionally trail after a slash.
	const noMatch = rest.match(/\bno\s*[:.\s]\s*(\d+[A-Za-z]?)(?:\s*\/\s*(\d+[A-Za-z]?))?/i);
	if (noMatch) {
		buildingNo = noMatch[1];
		if (noMatch[2]) apartmentNo = noMatch[2];
		rest = (rest.slice(0, noMatch.index) + rest.slice(noMatch.index! + noMatch[0].length)).trim();
		rest = rest.replace(/,\s*,/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "");
	}

	// "Daire: 8" / "D:8" / "D.8"
	const dMatch = rest.match(/\b(?:daire|d)\s*[:.\s]\s*(\d+[A-Za-z]?)/i);
	if (dMatch) {
		apartmentNo = dMatch[1];
		rest = (rest.slice(0, dMatch.index) + rest.slice(dMatch.index! + dMatch[0].length)).trim();
		rest = rest.replace(/,\s*,/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "");
	}

	return { rest, buildingNo, apartmentNo };
}

// Google formats Turkish place names like:
//   "Yunus Emre, 1328/2. Sk. No:34, 34260 Sultangazi/İstanbul"
//   "Atatürk Mah., Cumhuriyet Cd. No:42 Daire:8, Kadıköy/İstanbul"
// The structure varies, so we identify segments by their content rather than
// relying on a fixed positional split.
export function splitPlaceName(name: string): SplitPlaceName {
	const segments = name.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
	const out: SplitPlaceName = {};
	if (segments.length === 0) return out;

	// 1) Last segment may be "District/City" or "City" or "City, Country".
	//    With trailing "Türkiye": treat it as country.
	let tail = segments[segments.length - 1];
	if (/^t[üu]rkiye$/i.test(tail) && segments.length >= 2) {
		out.country = tail;
		segments.pop();
		tail = segments[segments.length - 1];
	}

	// "Sultangazi/İstanbul" → district = Sultangazi, city = İstanbul.
	// Strip any leading ZIP code first.
	const tailNoZip = stripLeadingZip(tail);
	if (tailNoZip.includes("/")) {
		const [district, city] = tailNoZip.split("/").map((s) => s.trim()).filter(Boolean);
		if (district) out.district = district;
		if (city) out.city = city;
		segments.pop();
	} else if (TURKISH_PROVINCES.has(tailNoZip.toLowerCase())) {
		out.city = tailNoZip;
		segments.pop();
	} else if (segments.length >= 2) {
		// Two trailing segments: assume "District, City".
		out.city = tailNoZip;
		segments.pop();
		out.district = stripLeadingZip(segments.pop()!);
	} else {
		// Single tail token, unknown — treat as city (best-effort).
		out.city = tailNoZip;
		segments.pop();
	}

	// 2) Of the remaining segments, find a mahalle ("Foo Mah." / "Foo Mahallesi")
	//    and the street (the one with a street suffix and/or "No:").
	const remaining = segments;
	const mahalleIdx = remaining.findIndex((s) => /\bMah(?:\.|allesi)\b/i.test(s));
	if (mahalleIdx !== -1) {
		out.mahalle = remaining[mahalleIdx].replace(/\s*Mah(?:\.|allesi)\s*$/i, "").trim();
		remaining.splice(mahalleIdx, 1);
	}

	// Street: the segment with street suffix or door numbers — typically the
	// last remaining segment.
	if (remaining.length > 0) {
		const streetIdx = (() => {
			for (let i = remaining.length - 1; i >= 0; i--) {
				if (TURKISH_STREET_TOKENS.test(remaining[i]) || /\bno\s*[:.\s]/i.test(remaining[i])) return i;
			}
			return remaining.length - 1;
		})();
		const streetSeg = remaining.splice(streetIdx, 1)[0];
		const { rest, buildingNo, apartmentNo } = extractDoorNumbers(streetSeg);
		if (rest) out.street = rest;
		if (buildingNo) out.buildingNo = buildingNo;
		if (apartmentNo) out.apartmentNo = apartmentNo;
	}

	// Anything left (rare): if no mahalle yet and one segment remains, treat it
	// as the mahalle (Google often leads with the neighborhood name even without
	// "Mah." suffix, e.g. "Yunus Emre").
	if (!out.mahalle && remaining.length === 1) {
		out.mahalle = remaining[0];
	}

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
