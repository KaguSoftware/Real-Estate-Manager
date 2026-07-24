// Prefilled WhatsApp message builders.
//
// Agents share listings over WhatsApp constantly and currently retype every
// detail by hand. These build the text; whatsappUrl() attaches it.
//
// CLIENT-SAFE BY CONSTRUCTION: the token table below is an explicit whitelist
// built from named property fields — nothing spreads a property object. Same
// rule as the brochure PDF: the homeowner's name and the tapu identifiers
// (ada/parsel) are exactly the data an agent must not hand a client, so no
// token resolves to them and no team template can surface them.
//
// No em dashes in anything a client reads: they signal machine-written text and
// render inconsistently across chat clients.

import { fmtMoney } from "./format";
import { interpolate } from "./pdf/interpolate";

/** The only property fields a client-facing message may read. */
export interface ShareableProperty {
	address_line: string;
	city?: string | null;
	nitelik?: string | null;
	size_sqm?: number | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	listing_type?: "for_rent" | "for_sale";
	list_price?: number | null;
	currency?: string | null;
}

export interface MessageContext {
	/** Office or agent name, available as {gonderen}. */
	senderName?: string | null;
	/** Client's name, available as {ad}. */
	recipientName?: string | null;
}

/**
 * Default template. Turkish tokens so an office owner editing this in settings
 * reads field names in their own language.
 *
 * Every token is optional at render time: `renderPropertyMessage` drops lines
 * whose only tokens are empty, so a property with no price doesn't leave a
 * dangling "Fiyat:" label.
 */
export const DEFAULT_PROPERTY_TEMPLATE = [
	"Merhaba {ad},",
	"",
	"{tur} | {adres}",
	"{ozellikler}",
	"{fiyatEtiketi}: {fiyat}",
	"",
	"{gonderen}",
].join("\n");

/** Tokens an office owner may use, with a Turkish description for the UI. */
export const MESSAGE_TOKENS: { token: string; description: string }[] = [
	{ token: "{ad}", description: "Müşterinin adı" },
	{ token: "{tur}", description: "Kiralık / Satılık" },
	{ token: "{adres}", description: "Adres ve şehir" },
	{ token: "{ozellikler}", description: "Nitelik, m², oda sayısı" },
	{ token: "{fiyat}", description: "Fiyat veya aylık kira" },
	{ token: "{fiyatEtiketi}", description: '"Fiyat" veya "Aylık kira"' },
	{ token: "{gonderen}", description: "Ofis / danışman adı" },
];

/** Resolve the whitelisted tokens for one property. Values may be "". */
export function propertyTokens(
	property: ShareableProperty,
	context: MessageContext = {},
): Record<string, string> {
	const typeLabel =
		property.listing_type === "for_rent" ? "Kiralık"
		: property.listing_type === "for_sale" ? "Satılık"
		: "";

	const adres = [property.address_line, property.city?.trim()]
		.filter((v): v is string => !!v && v.length > 0)
		.join(", ");

	const ozellikler = [
		property.nitelik?.trim() || null,
		property.size_sqm != null ? `${property.size_sqm} m²` : null,
		property.bedrooms != null ? `${property.bedrooms} oda` : null,
	].filter(Boolean).join(" · ");

	return {
		ad: context.recipientName?.trim() || "",
		tur: typeLabel,
		adres,
		ozellikler,
		fiyat:
			property.list_price != null
				? fmtMoney(property.list_price, property.currency || "TRY")
				: "",
		fiyatEtiketi: property.listing_type === "for_rent" ? "Aylık kira" : "Fiyat",
		gonderen: context.senderName?.trim() || "",
	};
}

/**
 * Render a template against a property.
 *
 * Lines are dropped when every token they contain resolves to empty, so an
 * absent price or client name leaves no orphaned label or "Merhaba ," behind.
 * Literal-only lines (like a blank separator) are always kept.
 */
export function renderPropertyMessage(
	property: ShareableProperty,
	context: MessageContext = {},
	template: string = DEFAULT_PROPERTY_TEMPLATE,
): string {
	const vars = propertyTokens(property, context);

	// {fiyatEtiketi} is a label, not data: it always resolves, so a line
	// containing only it plus an empty {fiyat} must still be dropped.
	const LABEL_ONLY = new Set(["fiyatEtiketi"]);

	const rendered = template.split("\n").map((line) => {
		const tokens = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
		// Unknown tokens (a typo in a team template) are left alone so the author
		// can see the mistake — they never suppress a line, and never resolve to
		// property data.
		const known = tokens.filter((t) => t in vars && !LABEL_ONLY.has(t));
		// A line whose data tokens are all empty is a label with nothing to
		// label. Drop it rather than print "Fiyat: ".
		if (known.length > 0 && known.every((t) => !vars[t])) return null;
		return interpolate(line, vars).replace(/\s+([,:])/g, "$1").trimEnd();
	});

	return rendered
		.filter((l): l is string => l !== null)
		.join("\n")
		// Collapse the runs of blank lines left by dropped lines.
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Message for a selection of properties — the WhatsApp counterpart to the
 * brochure PDF, for when a client wants the shortlist as text.
 */
export function propertyListMessage(
	properties: ShareableProperty[],
	context: MessageContext = {},
): string {
	const lines: string[] = [];

	const greeting = context.recipientName?.trim();
	if (greeting) lines.push(`Merhaba ${greeting},`, "");
	lines.push(`Sizin için ${properties.length} taşınmaz seçtim:`, "");

	properties.forEach((p, i) => {
		const t = propertyTokens(p);
		lines.push(`${i + 1}. ${t.adres}`);
		const facts = [t.ozellikler, t.fiyat].filter(Boolean).join(" · ");
		if (facts) lines.push(`   ${facts}`);
	});

	const sender = context.senderName?.trim();
	if (sender) lines.push("", sender);

	return lines.join("\n");
}
