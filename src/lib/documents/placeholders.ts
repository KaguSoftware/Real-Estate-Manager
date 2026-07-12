// Placeholder-token catalog for clause templates. The team template editor
// shows these as insertable chips and validates clause text against them;
// interpolate() (src/lib/pdf/interpolate.ts) resolves them at document build
// time. Keep in sync with the clauseVars built in sections/rental.tsx and
// sections/sales.tsx.

export type TemplateKind = "rental" | "sales";

export interface PlaceholderDef {
	/** Token as written inside clause text, without braces. */
	token: string;
	/** Human label shown in the template editor (Turkish). */
	label: string;
	/** Example value, for the chip tooltip / legend. */
	example: string;
}

export const RENTAL_PLACEHOLDERS: PlaceholderDef[] = [
	{ token: "monthly_rent", label: "Aylık kira", example: "25.000" },
	{ token: "deposit", label: "Depozito", example: "50.000" },
	{ token: "currency", label: "Para birimi", example: "TRY" },
	{ token: "start_date", label: "Başlangıç tarihi", example: "1 Ağustos 2026" },
	{ token: "payment_day", label: "Ödeme günü", example: "5" },
	{ token: "notice_days", label: "Bildirim süresi (gün)", example: "3" },
	{ token: "utilities_summary", label: "Abonelik özeti", example: "Elektrik: Kiracı; Su: Kiracı…" },
	{ token: "subletting_clause", label: "Alt kira hükmü", example: "KİRACI … alt kiraya veremez…" },
	{ token: "rent_increase_clause", label: "Kira artışı hükmü", example: "Kira bedeli … TÜFE …" },
];

export const SALES_PLACEHOLDERS: PlaceholderDef[] = [
	{ token: "sale_price", label: "Satış bedeli", example: "5.250.000" },
	{ token: "currency", label: "Para birimi", example: "TRY" },
	{ token: "deposit_amount", label: "Kapora", example: "250.000" },
	{ token: "penalty_amount", label: "Cezai şart", example: "500.000" },
	{ token: "target_close_date", label: "Devir tarihi", example: "30 Eylül 2026" },
	{ token: "validity_days", label: "Geçerlilik (gün)", example: "60" },
	{ token: "tax_responsibility_clause", label: "Vergi sorumluluğu hükmü", example: "ALICI tarafından ödenecektir." },
	{ token: "agency_name", label: "Ofis adı", example: "KAGU GAYRİMENKUL" },
	{ token: "jurisdiction_city", label: "Yetkili mahkeme şehri", example: "İstanbul" },
];

export const PLACEHOLDERS_BY_KIND: Record<TemplateKind, PlaceholderDef[]> = {
	rental: RENTAL_PLACEHOLDERS,
	sales: SALES_PLACEHOLDERS,
};

/** Tokens referenced in `text` that are not in the kind's catalog. */
export function findUnknownTokens(kind: TemplateKind, text: string): string[] {
	const known = new Set(PLACEHOLDERS_BY_KIND[kind].map((p) => p.token));
	const found = new Set<string>();
	for (const m of text.matchAll(/\{(\w+)\}/g)) {
		if (!known.has(m[1])) found.add(m[1]);
	}
	return [...found];
}
