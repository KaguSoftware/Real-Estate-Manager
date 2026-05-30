/**
 * One-off geocoding backfill for existing properties.
 *
 *   npm run backfill:geocode
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local,
 * selects every properties row where latitude IS NULL, and geocodes via OSM
 * Nominatim at ≤ 1 request per second (Nominatim usage policy).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

interface Row {
	id: string;
	address_line: string | null;
	mahalle: string | null;
	mevkii: string | null;
	city: string | null;
}

const NOMINATIM_EMAIL = "real-estate-manager@example.com";

function loadDotEnvLocal(): void {
	const path = resolve(process.cwd(), ".env.local");
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		console.error(`Could not read ${path}`);
		process.exit(1);
	}
	for (const line of raw.split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
		if (!m) continue;
		const [, key, rawVal] = m;
		const val = rawVal.replace(/^['"]|['"]$/g, "");
		if (!(key in process.env)) process.env[key] = val;
	}
}

function buildQuery(r: Row): string {
	return [r.address_line, r.mahalle, r.mevkii, r.city]
		.map((p) => (p ?? "").trim())
		.filter((p) => p.length > 0)
		.join(", ");
}

async function geocode(q: string): Promise<{ lat: number; lon: number } | null> {
	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "1");
	url.searchParams.set("email", NOMINATIM_EMAIL);
	url.searchParams.set("q", q);

	const res = await fetch(url.toString(), {
		headers: {
			Accept: "application/json",
			"User-Agent": `real-estate-manager-backfill (${NOMINATIM_EMAIL})`,
		},
	});
	if (!res.ok) return null;
	const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
	if (!rows.length) return null;
	const lat = Number(rows[0].lat);
	const lon = Number(rows[0].lon);
	return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

async function main(): Promise<void> {
	loadDotEnvLocal();

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
		process.exit(1);
	}

	const supabase = createClient(url, key, { auth: { persistSession: false } });

	const { data, error } = await supabase
		.from("properties")
		.select("id, address_line, mahalle, mevkii, city")
		.is("latitude", null);
	if (error) {
		console.error("Select failed:", error.message);
		process.exit(1);
	}

	const rows = (data ?? []) as Row[];
	console.log(`Found ${rows.length} properties without coordinates.`);
	if (rows.length === 0) return;

	let ok = 0;
	let skip = 0;
	let fail = 0;

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const q = buildQuery(r);
		const label = `[${i + 1}/${rows.length}] ${r.id}`;
		if (!q) {
			console.log(`${label}  skip (no address)`);
			skip++;
			continue;
		}

		try {
			const hit = await geocode(q);
			if (!hit) {
				console.log(`${label}  miss ("${q}")`);
				fail++;
			} else {
				const { error: upErr } = await supabase
					.from("properties")
					.update({ latitude: hit.lat, longitude: hit.lon })
					.eq("id", r.id);
				if (upErr) {
					console.log(`${label}  update error: ${upErr.message}`);
					fail++;
				} else {
					console.log(`${label}  OK  ${hit.lat.toFixed(5)}, ${hit.lon.toFixed(5)}`);
					ok++;
				}
			}
		} catch (e) {
			console.log(`${label}  error: ${e instanceof Error ? e.message : String(e)}`);
			fail++;
		}

		// Nominatim policy: max 1 req/sec. Sleep 1.1s between requests.
		if (i < rows.length - 1) {
			await new Promise((r) => setTimeout(r, 1100));
		}
	}

	console.log(`\nDone. ok=${ok} miss/err=${fail} skip=${skip}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
