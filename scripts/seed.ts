/**
 * Sample-data seeder for local/dev Supabase projects.
 *
 *   npm run seed            # add-only: skips any team that already has properties
 *   npm run seed -- --force # seed even if the team already has properties
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (same convention as scripts/backfill-geocode.ts) and uses the service-role
 * client, so RLS is bypassed — CHECK constraints and triggers still apply.
 *
 * Seeds, per target account's team:
 *   properties (10), tenants (8), leads (6), leases (active + ended),
 *   payments (~6 months per active lease), sales (for sold properties),
 *   notifications (a couple of rows using types allowed by the CHECK).
 *
 * Intentionally NOT seeded:
 *   - "documents": storage-bucket only (migration 0009) — rows would require
 *     real PDF files in the private bucket, which this script must not create.
 *   - contract_documents (0017): rows require app-generated Tiptap `content`
 *     and a RentalPDFData/SalesPDFData `source_data` snapshot; fabricated
 *     shapes risk breaking the document editor, so they are skipped.
 *   - property_images: storage_path must point at real objects in the
 *     property-images bucket.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TARGET_EMAILS = [
	"saitaydin.kagu@gmail.com",
	"parsaa.mansourii@gmail.com",
] as const;

const FORCE = process.argv.includes("--force");
// --only=<email> restricts the run to one target account.
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length)?.toLowerCase() ?? null;
const EMAILS = TARGET_EMAILS.filter((e) => !ONLY || e.toLowerCase() === ONLY);

// ── env ──────────────────────────────────────────────────────────────────────

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

// ── date helpers (deterministic relative to "today") ─────────────────────────

function iso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** First day of the month, `n` months before the current month. */
function monthStart(n: number): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
}

/** Last day of the month that starts at `start`. */
function monthEnd(start: Date): Date {
	return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
}

function addYears(d: Date, years: number): Date {
	return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
}

// ── fixture data (hardcoded, no faker) ───────────────────────────────────────

interface PropertyFixture {
	homeowner_name: string;
	address_line: string;
	city: string;
	mahalle: string;
	nitelik: string;
	size_sqm: number;
	bedrooms: number;
	bathrooms: number;
	listing_type: "for_rent" | "for_sale";
	status: "vacant" | "occupied" | "sold";
	list_price: number; // monthly rent for for_rent, sale price for for_sale (TRY)
	furnished: boolean;
	latitude: number;
	longitude: number;
	notes: string | null;
}

// Real, approximate coordinates for well-known Istanbul / Ankara neighborhoods.
const PROPERTIES: PropertyFixture[] = [
	// for_rent / occupied  → active lease + payments
	{ homeowner_name: "Mehmet Yılmaz", address_line: "Caferağa Mah. Moda Cad. No: 112 D:4", city: "İstanbul", mahalle: "Caferağa", nitelik: "2+1", size_sqm: 95, bedrooms: 2, bathrooms: 1, listing_type: "for_rent", status: "occupied", list_price: 42000, furnished: true, latitude: 40.9819, longitude: 29.0254, notes: "Moda sahiline 5 dk yürüme mesafesi." },
	{ homeowner_name: "Ayşe Demir", address_line: "Sinanpaşa Mah. Ihlamurdere Cad. No: 48 D:7", city: "İstanbul", mahalle: "Sinanpaşa", nitelik: "3+1", size_sqm: 130, bedrooms: 3, bathrooms: 2, listing_type: "for_rent", status: "occupied", list_price: 58000, furnished: false, latitude: 41.0430, longitude: 29.0046, notes: "Beşiktaş çarşıya yakın, asansörlü bina." },
	{ homeowner_name: "Hasan Kaya", address_line: "Kızılay Mah. Atatürk Bulvarı No: 95 D:12", city: "Ankara", mahalle: "Kızılay", nitelik: "1+1", size_sqm: 62, bedrooms: 1, bathrooms: 1, listing_type: "for_rent", status: "occupied", list_price: 21000, furnished: true, latitude: 39.9208, longitude: 32.8541, notes: "Metroya 2 dk, öğrenci ve genç profesyonellere uygun." },
	{ homeowner_name: "Fatma Şahin", address_line: "Bahçelievler Mah. 7. Cadde No: 23 D:5", city: "Ankara", mahalle: "Bahçelievler", nitelik: "3+1", size_sqm: 125, bedrooms: 3, bathrooms: 2, listing_type: "for_rent", status: "occupied", list_price: 32000, furnished: false, latitude: 39.9179, longitude: 32.8210, notes: "Çankaya, 7. Cadde üzerinde yenilenmiş daire." },
	// for_rent / vacant (one of them had an ended lease)
	{ homeowner_name: "Ali Çelik", address_line: "Osmanağa Mah. Söğütlüçeşme Cad. No: 67 D:3", city: "İstanbul", mahalle: "Osmanağa", nitelik: "2+1", size_sqm: 88, bedrooms: 2, bathrooms: 1, listing_type: "for_rent", status: "vacant", list_price: 38000, furnished: false, latitude: 40.9903, longitude: 29.0301, notes: "Kadıköy merkez, boyası yeni yapıldı." },
	{ homeowner_name: "Zeynep Arslan", address_line: "Ayrancı Mah. Güvenlik Cad. No: 34 D:9", city: "Ankara", mahalle: "Ayrancı", nitelik: "2+1", size_sqm: 105, bedrooms: 2, bathrooms: 1, listing_type: "for_rent", status: "vacant", list_price: 27500, furnished: true, latitude: 39.8961, longitude: 32.8489, notes: "Önceki kiracı çıktı, hemen taşınmaya hazır." },
	// for_sale / vacant
	{ homeowner_name: "Mustafa Koç", address_line: "Vişnezade Mah. Şair Nedim Cad. No: 19 D:2", city: "İstanbul", mahalle: "Vişnezade", nitelik: "4+1", size_sqm: 185, bedrooms: 4, bathrooms: 2, listing_type: "for_sale", status: "vacant", list_price: 24500000, furnished: false, latitude: 41.0451, longitude: 29.0074, notes: "Beşiktaş, Boğaz manzaralı geniş daire." },
	{ homeowner_name: "Elif Aydın", address_line: "Fenerbahçe Mah. Bağdat Cad. No: 141 D:8", city: "İstanbul", mahalle: "Fenerbahçe", nitelik: "3+1", size_sqm: 150, bedrooms: 3, bathrooms: 2, listing_type: "for_sale", status: "vacant", list_price: 18750000, furnished: false, latitude: 40.9713, longitude: 29.0450, notes: "Bağdat Caddesi üzerinde, site içinde." },
	// for_sale / sold → sales rows
	{ homeowner_name: "İbrahim Öztürk", address_line: "Gaziosmanpaşa Mah. Filistin Cad. No: 8 D:6", city: "Ankara", mahalle: "Gaziosmanpaşa", nitelik: "3+1", size_sqm: 140, bedrooms: 3, bathrooms: 2, listing_type: "for_sale", status: "sold", list_price: 9800000, furnished: false, latitude: 39.9030, longitude: 32.8657, notes: "Çankaya GOP, büyükelçilikler bölgesi." },
	{ homeowner_name: "Hatice Doğan", address_line: "Rasimpaşa Mah. Karakolhane Cad. No: 55 D:1", city: "İstanbul", mahalle: "Rasimpaşa", nitelik: "1+1", size_sqm: 58, bedrooms: 1, bathrooms: 1, listing_type: "for_sale", status: "sold", list_price: 6250000, furnished: false, latitude: 40.9958, longitude: 29.0246, notes: "Yeldeğirmeni, yatırımlık daire — satışı tamamlandı." },
];

interface PersonFixture { full_name: string; phone: string; email: string }

const TENANTS: PersonFixture[] = [
	{ full_name: "Emre Yıldız", phone: "0532 415 78 23", email: "emre.yildiz@example.com" },
	{ full_name: "Selin Kurt", phone: "0535 862 14 90", email: "selin.kurt@example.com" },
	{ full_name: "Burak Aksoy", phone: "0542 903 55 17", email: "burak.aksoy@example.com" },
	{ full_name: "Deniz Polat", phone: "0505 237 41 68", email: "deniz.polat@example.com" },
	{ full_name: "Merve Erdoğan", phone: "0553 719 02 34", email: "merve.erdogan@example.com" },
	{ full_name: "Kerem Güneş", phone: "0533 481 26 75", email: "kerem.gunes@example.com" },
	{ full_name: "Gamze Aslan", phone: "0544 650 93 12", email: "gamze.aslan@example.com" },
	{ full_name: "Onur Tekin", phone: "0507 128 46 59", email: "onur.tekin@example.com" },
];

interface LeadFixture extends PersonFixture {
	interested_in: string;
	pref_listing_type: "for_rent" | "for_sale";
	pref_nitelik: string | null;
	pref_min_bedrooms: number | null;
	pref_location: string | null;
	status: "new" | "called_rejected" | "follow_up" | "interested" | "closed";
	notes: string | null;
	last_call_days_ago: number | null;
}

const LEADS: LeadFixture[] = [
	{ full_name: "Cem Karaca", phone: "0536 274 81 05", email: "cem.karaca@example.com", interested_in: "Kadıköy'de eşyalı 2+1 kiralık", pref_listing_type: "for_rent", pref_nitelik: "2+1", pref_min_bedrooms: 2, pref_location: "Kadıköy", status: "interested", notes: "Bütçesi aylık 45.000 TL'ye kadar.", last_call_days_ago: 2 },
	{ full_name: "Nazlı Ateş", phone: "0545 390 62 47", email: "nazli.ates@example.com", interested_in: "Beşiktaş'ta satılık 3+1 veya 4+1", pref_listing_type: "for_sale", pref_nitelik: "3+1", pref_min_bedrooms: 3, pref_location: "Beşiktaş", status: "follow_up", notes: "Banka kredisi onayı bekleniyor.", last_call_days_ago: 5 },
	{ full_name: "Tolga Şen", phone: "0531 807 39 24", email: "tolga.sen@example.com", interested_in: "Çankaya'da kiralık 1+1", pref_listing_type: "for_rent", pref_nitelik: "1+1", pref_min_bedrooms: 1, pref_location: "Çankaya", status: "new", notes: null, last_call_days_ago: null },
	{ full_name: "Ebru Çetin", phone: "0554 162 95 38", email: "ebru.cetin@example.com", interested_in: "Bağdat Caddesi civarı satılık daire", pref_listing_type: "for_sale", pref_nitelik: null, pref_min_bedrooms: 3, pref_location: "Fenerbahçe", status: "follow_up", notes: "Eylül ayında taşınmak istiyor.", last_call_days_ago: 9 },
	{ full_name: "Serkan Bulut", phone: "0538 546 20 71", email: "serkan.bulut@example.com", interested_in: "Ankara Kızılay çevresi kiralık ofis/daire", pref_listing_type: "for_rent", pref_nitelik: null, pref_min_bedrooms: null, pref_location: "Kızılay", status: "called_rejected", notes: "Fiyatları yüksek buldu.", last_call_days_ago: 14 },
	{ full_name: "Pınar Özkan", phone: "0549 731 08 66", email: "pinar.ozkan@example.com", interested_in: "Yatırımlık küçük daire", pref_listing_type: "for_sale", pref_nitelik: "1+1", pref_min_bedrooms: 1, pref_location: "Kadıköy", status: "closed", notes: "Yeldeğirmeni'ndeki daireyi satın aldı.", last_call_days_ago: 30 },
];

// ── seeding ──────────────────────────────────────────────────────────────────

type Db = SupabaseClient;

async function insertReturningIds(
	supabase: Db,
	table: string,
	rows: Record<string, unknown>[],
): Promise<string[]> {
	const { data, error } = await supabase.from(table).insert(rows).select("id");
	if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
	return (data ?? []).map((r: { id: string }) => r.id);
}

async function findUserId(supabase: Db, email: string): Promise<string | null> {
	// profiles mirrors auth.users (0001_init trigger) — cheaper than paging listUsers.
	const { data, error } = await supabase
		.from("profiles")
		.select("id")
		.eq("email", email)
		.maybeSingle();
	if (error) throw new Error(`profiles lookup for ${email} failed: ${error.message}`);
	if (data?.id) return data.id as string;

	// Fallback: auth admin API (covers a profile-trigger miss).
	const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
	if (listErr) throw new Error(`auth.admin.listUsers failed: ${listErr.message}`);
	const hit = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
	return hit?.id ?? null;
}

interface Summary { [table: string]: number }

async function seedTeam(supabase: Db, email: string): Promise<Summary | null> {
	console.log(`\n── ${email} ${"─".repeat(Math.max(0, 60 - email.length))}`);

	const userId = await findUserId(supabase, email);
	if (!userId) {
		console.log("  skip: no user with this email exists.");
		return null;
	}

	const { data: membership, error: tmErr } = await supabase
		.from("team_members")
		.select("team_id")
		.eq("user_id", userId)
		.maybeSingle();
	if (tmErr) throw new Error(`team_members lookup failed: ${tmErr.message}`);
	if (!membership?.team_id) {
		console.log("  skip: user has no team (team_members row missing).");
		return null;
	}
	const teamId = membership.team_id as string;

	// ADD-ONLY guard
	const { count, error: cntErr } = await supabase
		.from("properties")
		.select("id", { count: "exact", head: true })
		.eq("team_id", teamId);
	if (cntErr) throw new Error(`properties count failed: ${cntErr.message}`);
	if ((count ?? 0) > 0 && !FORCE) {
		console.log(`  skip: team already has ${count} properties (pass --force to seed anyway).`);
		return null;
	}

	const base = { team_id: teamId, created_by: userId };
	const summary: Summary = {};

	// 1. properties
	const propertyIds = await insertReturningIds(
		supabase,
		"properties",
		PROPERTIES.map((p) => ({
			...base,
			homeowner_name: p.homeowner_name,
			address_line: p.address_line,
			city: p.city,
			mahalle: p.mahalle,
			nitelik: p.nitelik,
			size_sqm: p.size_sqm,
			bedrooms: p.bedrooms,
			bathrooms: p.bathrooms,
			listing_type: p.listing_type,
			status: p.status,
			list_price: p.list_price,
			currency: "TRY",
			furnished: p.furnished,
			latitude: p.latitude,
			longitude: p.longitude,
			notes: p.notes,
		})),
	);
	summary.properties = propertyIds.length;

	// 2. tenants
	const tenantIds = await insertReturningIds(
		supabase,
		"tenants",
		TENANTS.map((t) => ({ ...base, full_name: t.full_name, phone: t.phone, email: t.email })),
	);
	summary.tenants = tenantIds.length;

	// 3. leads
	const leadIds = await insertReturningIds(
		supabase,
		"leads",
		LEADS.map((l) => ({
			...base,
			full_name: l.full_name,
			phone: l.phone,
			email: l.email,
			interested_in: l.interested_in,
			pref_listing_type: l.pref_listing_type,
			pref_nitelik: l.pref_nitelik,
			pref_min_bedrooms: l.pref_min_bedrooms,
			pref_location: l.pref_location,
			status: l.status,
			notes: l.notes,
			last_call_at:
				l.last_call_days_ago === null
					? null
					: iso(new Date(Date.now() - l.last_call_days_ago * 86_400_000)),
		})),
	);
	summary.leads = leadIds.length;

	// 4. leases
	//    Occupied rentals = PROPERTIES[0..3]; vacant-rental PROPERTIES[4..5]
	//    get ended leases from former tenants.
	const rents = [42000, 58000, 21000, 32000]; // matches occupied list_price
	const activeLeaseRows = [0, 1, 2, 3].map((i) => {
		const start = monthStart(5 + i); // 5–8 months ago
		return {
			...base,
			property_id: propertyIds[i],
			tenant_id: tenantIds[i],
			term: "1yr",
			start_date: iso(start),
			end_date: iso(addYears(start, 1)),
			monthly_rent: rents[i],
			deposit: rents[i] * 2,
			currency: "TRY",
			status: "active",
			payment_day: 5,
			payment_method: "Banka havalesi",
		};
	});
	const endedLeaseRows = [4, 5].map((i) => {
		const start = monthStart(20 + (i - 4) * 4); // 20 / 24 months ago
		const end = addYears(start, 1);
		return {
			...base,
			property_id: propertyIds[i],
			tenant_id: tenantIds[i],
			term: "1yr",
			start_date: iso(start),
			end_date: iso(end),
			monthly_rent: i === 4 ? 29000 : 22000,
			deposit: i === 4 ? 58000 : 44000,
			currency: "TRY",
			status: "ended",
			payment_day: 1,
			payment_method: "Banka havalesi",
		};
	});
	const activeLeaseIds = await insertReturningIds(supabase, "leases", activeLeaseRows);
	const endedLeaseIds = await insertReturningIds(supabase, "leases", endedLeaseRows);
	summary.leases = activeLeaseIds.length + endedLeaseIds.length;

	// 5. payments — last ~6 months per active lease; the newest 1–2 periods of
	//    leases #2 and #3 are left unpaid/overdue.
	const paymentRows: Record<string, unknown>[] = [];
	activeLeaseIds.forEach((leaseId, li) => {
		for (let m = 5; m >= 0; m--) {
			const start = monthStart(m);
			const unpaid = (li === 2 && m === 0) || (li === 3 && m <= 1);
			paymentRows.push({
				...base,
				lease_id: leaseId,
				period_start: iso(start),
				period_end: iso(monthEnd(start)),
				amount_due: rents[li],
				amount_paid: unpaid ? 0 : rents[li],
				paid_at: unpaid
					? null
					: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 5, 10)).toISOString(),
				method: unpaid ? null : "Banka havalesi",
				notes: unpaid ? "Ödeme bekleniyor" : null,
			});
		}
	});
	await insertReturningIds(supabase, "payments", paymentRows);
	summary.payments = paymentRows.length;

	// 6. sales — sold properties are PROPERTIES[8..9]; buyers reuse tenants.
	const saleRows = [8, 9].map((i, k) => ({
		...base,
		property_id: propertyIds[i],
		buyer_id: tenantIds[6 + k],
		sale_price: PROPERTIES[i].list_price,
		currency: "TRY",
		sale_date: iso(monthStart(2 + k)),
		deposit_amount: Math.round(PROPERTIES[i].list_price * 0.1),
		tax_responsibility: "legal",
		buyer_commission_rate: 2.0,
		seller_commission_rate: 2.0,
		status: "closed",
	}));
	await insertReturningIds(supabase, "sales", saleRows);
	summary.sales = saleRows.length;

	// 7. notifications — CHECK constrains type to the onboarding/billing set,
	//    so use allowed types with harmless demo copy.
	const notificationRows = [
		{
			user_id: userId,
			team_id: teamId,
			type: "trial_started",
			title: "Deneme süreniz başladı",
			body: "14 günlük deneme süreniz aktif. İyi çalışmalar!",
		},
		{
			user_id: userId,
			team_id: teamId,
			type: "member_joined",
			title: "Örnek veriler yüklendi",
			body: "Demo portföy (10 mülk, kiracılar, sözleşmeler ve ödemeler) hesabınıza eklendi.",
		},
	];
	await insertReturningIds(supabase, "notifications", notificationRows);
	summary.notifications = notificationRows.length;

	for (const [table, n] of Object.entries(summary)) {
		console.log(`  ${table.padEnd(14)} +${n}`);
	}
	return summary;
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
	console.log(`Seeding sample data${FORCE ? " (--force)" : ""} for ${EMAILS.length} account(s)…`);

	const totals: Summary = {};
	let seededTeams = 0;
	for (const email of EMAILS) {
		const summary = await seedTeam(supabase, email);
		if (!summary) continue;
		seededTeams++;
		for (const [table, n] of Object.entries(summary)) {
			totals[table] = (totals[table] ?? 0) + n;
		}
	}

	console.log(`\nDone. Seeded ${seededTeams} team(s).`);
	if (seededTeams > 0) {
		console.log(
			Object.entries(totals)
				.map(([t, n]) => `${t}=${n}`)
				.join("  "),
		);
	}
	console.log(
		"Skipped by design: documents (storage-only bucket), contract_documents (needs app-generated Tiptap/source_data), property_images (needs real storage objects).",
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
