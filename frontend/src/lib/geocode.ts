// Geocoding via OpenStreetMap Nominatim (free, no API key).
// Usage policy: max 1 req/sec, send an identifying email. See
// https://operations.osmfoundation.org/policies/nominatim/

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

const NOMINATIM_EMAIL = "real-estate-manager@example.com";

function buildQuery(parts: GeocodeParts): string {
	return [parts.address_line, parts.mahalle, parts.mevkii, parts.city]
		.map((p) => (p ?? "").trim())
		.filter((p) => p.length > 0)
		.join(", ");
}

export async function geocodeAddress(parts: GeocodeParts): Promise<GeocodeResult | null> {
	const q = buildQuery(parts);
	if (!q) return null;

	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", "1");
		url.searchParams.set("email", NOMINATIM_EMAIL);
		url.searchParams.set("q", q);

		const res = await fetch(url.toString(), {
			headers: { Accept: "application/json" },
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
