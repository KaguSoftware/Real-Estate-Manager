// Geocoding via OpenStreetMap Nominatim (free, no API key).
// Usage policy: max 1 req/sec, send an identifying email + User-Agent. See
// https://operations.osmfoundation.org/policies/nominatim/
//
// Both helpers here are intended to run server-side (from the /api/resolve-maps
// route handler) so the User-Agent header is honored and there are no CORS limits.

export interface GeocodeParts {
	address_line?: string | null;
	mahalle?: string | null;
	mevkii?: string | null;
	city?: string | null;
}

export interface GeocodeResult {
	lat: number;
	lon: number;
}

/** Structured address parts returned by Nominatim reverse geocoding. */
export interface ReverseAddress {
	road?: string;
	house_number?: string;
	neighbourhood?: string;
	quarter?: string;
	suburb?: string;
	town?: string;
	city?: string;
	village?: string;
	municipality?: string;
	county?: string;
	district?: string;
	province?: string;
	state?: string;
	postcode?: string;
	country?: string;
	country_code?: string;
}

// Identifying email per Nominatim policy. Override with NOMINATIM_EMAIL; the
// fallback keeps the app runnable without configuration.
const NOMINATIM_EMAIL = process.env.NOMINATIM_EMAIL || "parsaxavier@gmail.com";
const NOMINATIM_UA =
	"KaguRealEstate/1.0 (property geocoding; +https://github.com/KaguSoftware/RealEstate)";

// Nominatim allows at most 1 request/second. Both geocodeAddress and
// reverseGeocode funnel through this gate: each call waits until at least 1s has
// elapsed since the previous one started, by chaining onto a shared promise.
let nominatimChain: Promise<void> = Promise.resolve();
function rateLimit(): Promise<void> {
	const next = nominatimChain.then(() => new Promise<void>((r) => setTimeout(r, 1000)));
	// Keep the chain alive even if a caller's own work rejects.
	nominatimChain = next.catch(() => {});
	return next;
}

function buildQuery(parts: GeocodeParts): string {
	return [parts.address_line, parts.mahalle, parts.mevkii, parts.city]
		.map((p) => (p ?? "").trim())
		.filter((p) => p.length > 0)
		.join(", ");
}

/** Forward geocode: address parts → coordinates. */
export async function geocodeAddress(parts: GeocodeParts): Promise<GeocodeResult | null> {
	const q = buildQuery(parts);
	if (!q) return null;

	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", "1");
		url.searchParams.set("email", NOMINATIM_EMAIL);
		url.searchParams.set("q", q);

		await rateLimit();
		const res = await fetch(url.toString(), {
			headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
		});
		if (!res.ok) return null;

		const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
		if (!rows.length) return null;

		const lat = Number(rows[0].lat);
		const lon = Number(rows[0].lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

		return { lat, lon };
	} catch {
		return null;
	}
}

/** Reverse geocode: coordinates → structured address parts (Turkish where available). */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseAddress | null> {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

	try {
		const url = new URL("https://nominatim.openstreetmap.org/reverse");
		url.searchParams.set("format", "jsonv2");
		url.searchParams.set("addressdetails", "1");
		url.searchParams.set("accept-language", "tr");
		url.searchParams.set("email", NOMINATIM_EMAIL);
		url.searchParams.set("lat", String(lat));
		url.searchParams.set("lon", String(lon));

		await rateLimit();
		const res = await fetch(url.toString(), {
			headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
		});
		if (!res.ok) return null;

		const body = (await res.json()) as { address?: Record<string, string> };
		const a = body.address;
		if (!a) return null;

		// Pass through the fields we care about; Nominatim returns many more.
		const out: ReverseAddress = {};
		const keys: (keyof ReverseAddress)[] = [
			"road", "house_number", "neighbourhood", "quarter", "suburb", "town",
			"city", "village", "municipality", "county", "district", "province",
			"state", "postcode", "country", "country_code",
		];
		for (const k of keys) {
			const v = a[k];
			if (typeof v === "string" && v.trim()) out[k] = v.trim();
		}
		return Object.keys(out).length ? out : null;
	} catch {
		return null;
	}
}
