import { StyleSheet, Font } from "@react-pdf/renderer";

// Prevent word hyphenation in @react-pdf/renderer
Font.registerHyphenationCallback((word) => [word]);

// Fonts are registered LAZILY, on the client only — never at module top level.
//
// Two things must both be true for react-pdf to load a font in the browser:
//   1. The `src` must be an ABSOLUTE URL. @react-pdf/font picks its load path
//      with the `is-url` package: only strings with a scheme (https://…) take
//      the browser-capable `fetch` path. A root-relative "/fonts/x.ttf" is not a
//      URL to `is-url`, so react-pdf falls back to `fontkit.open(src)` which
//      reads from a filesystem — impossible in the browser. The font then loads
//      with no glyph metrics, every line is measured at zero height, and the
//      document collapses onto one baseline (the overlapping-text bug).
//   2. Registration must run where `window` exists. This module is reachable
//      during SSR (the wizard statically imports PDFDocument), so a top-level
//      `Font.register` would run on the server with `window` undefined, bake in
//      a relative "/fonts/…" path, and — because react-pdf memoizes the
//      registration — stay broken on the client forever.
//
// `ensurePdfFonts()` is idempotent and called from both the download path
// (generatePDFBlob) and the preview render (PDFDocument), always client-side.
//
// Unicode note: built-in Helvetica is WinAnsi-only and renders Turkish glyphs
// (ğ, İ, ş, ı, …) as fallbacks with stacked diacritics. Google Sans Flex covers
// Latin Extended-A in full. Weights: 400 body · 500 labels · 700 headings.
//
// Italic note: Google Sans Flex ships NO italic face (verified against the
// Google Fonts API — `ital@1` returns "font family not found"), and react-pdf
// does not synthesize oblique glyphs. An italic mark in editor content
// therefore renders as regular weight; the editor toolbar deliberately omits
// an italic button. Do not add `fontStyle: "italic"` styles here without also
// adding a real italic TTF to public/fonts and registering it below.
let fontsRegistered = false;
export function ensurePdfFonts(): void {
	if (fontsRegistered || typeof window === "undefined") return;
	const base = window.location.origin;
	Font.register({
		family: "Sans",
		fonts: [
			{ src: `${base}/fonts/GoogleSansFlex_36pt-Regular.ttf`, fontWeight: 400 },
			{ src: `${base}/fonts/GoogleSansFlex_120pt-Medium.ttf`, fontWeight: 500 },
			{ src: `${base}/fonts/GoogleSansFlex_36pt-Bold.ttf`,    fontWeight: 700 },
		],
	});
	fontsRegistered = true;
}

// Optional: await the registered weights so the first render never measures
// against unloaded fonts (avoids a preview flash). Registration runs first.
let fontsReady: Promise<void> | null = null;
export function loadPdfFonts(): Promise<void> {
	ensurePdfFonts();
	if (!fontsReady) {
		fontsReady = Promise.all([
			Font.load({ fontFamily: "Sans", fontWeight: 400 }),
			Font.load({ fontFamily: "Sans", fontWeight: 500 }),
			Font.load({ fontFamily: "Sans", fontWeight: 700 }),
		]).then(() => undefined);
	}
	return fontsReady;
}

// Single source of truth for page geometry. The fixed PageFooter is absolutely
// positioned, so it reserves no flow space — body content would run under it
// unless the page leaves room. Invariant the footer relies on:
//     PAGE_PADDING_BOTTOM ≥ FOOTER_BOTTOM + FOOTER_HEIGHT
// Keep these in sync if you touch either the page or the footer.
export const PAGE_PADDING = 48;
export const PAGE_PADDING_BOTTOM = 72;
export const FOOTER_BOTTOM = 20;
export const FOOTER_HEIGHT = 26;

export const colors = {
	slate900: "#0f172a",
	slate800: "#1e293b",
	slate700: "#334155",
	slate600: "#475569",
	slate500: "#64748b",
	slate400: "#94a3b8",
	slate300: "#cbd5e1",
	slate200: "#e2e8f0",
	slate100: "#f1f5f9",
	slate50:  "#f8fafc",
	white:    "#ffffff",
	emerald500: "#10b981",
	emerald600: "#059669",
	red500:   "#ef4444",
	indigo500: "#6366f1",
	indigo50:  "#eef2ff",
	amber500: "#f59e0b",
	// Hairline used for structural rules (row separators, card borders). Kept
	// palette-neutral: brand color is carried by chips, numerals and fills, not
	// by every border on the page.
	hairline: "#e4e7eb",
} as const;

export const styles = StyleSheet.create({
	page: {
		paddingTop: PAGE_PADDING,
		paddingBottom: PAGE_PADDING_BOTTOM, // reserves room for the fixed footer
		paddingHorizontal: PAGE_PADDING,
		fontFamily: "Sans",
		fontSize: 10,
		color: colors.slate800,
		// NO `lineHeight` here (and nowhere else in this file). react-pdf re-resolves
		// page styles on every pagination relayout, and its `processLineHeight`
		// re-multiplies a unitless lineHeight by fontSize each pass — so a value like
		// 1.5 compounds (15 → 150 → 1500 …) until textkit emits zero lines and text
		// collapses to height 0 (the A/B card overlap bug). `lineHeight` is inherited,
		// so the page value alone poisons every Text. Omitting it lets textkit use the
		// font's natural line height (lineGap + ascent − descent), which is stable
		// across relayouts. Do not reintroduce `lineHeight` as a unitless number.
		backgroundColor: colors.white,
	},

	// ── Header (receipt / listing) ─────────────────────────────────────
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		marginBottom: 12,
	},
	docType: {
		fontSize: 22,
		fontWeight: 700,
		color: colors.slate900,
		letterSpacing: -0.3,
		marginBottom: 2,
	},
	refLine: {
		fontSize: 8,
		color: colors.slate500,
		fontWeight: 500,
	},
	dividerThin: {
		width: "100%",
		height: 1.5,
		backgroundColor: colors.slate900,
		marginBottom: 22,
	},

	// ── Hero card (property address up top) ────────────────────────────
	hero: {
		backgroundColor: colors.slate50,
		paddingVertical: 13,
		paddingHorizontal: 16,
		marginBottom: 22,
	},
	heroLabel: {
		fontSize: 7,
		color: colors.slate500,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		fontWeight: 500,
		marginBottom: 5,
	},
	heroAddress: {
		fontSize: 15,
		fontWeight: 700,
		color: colors.slate900,
	},
	heroMeta: {
		fontSize: 9,
		color: colors.slate600,
		marginTop: 4,
	},

	// ── Section primitives ─────────────────────────────────────────────
	section: {
		marginBottom: 20,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 10,
	},
	sectionTitle: {
		fontSize: 10,
		color: colors.slate900,
		fontWeight: 700,
	},
	sectionRule: {
		flex: 1,
		height: 0.5,
		backgroundColor: colors.hairline,
		marginLeft: 10,
	},
	bodyText: {
		fontSize: 9.5,
		color: colors.slate700,
	},

	// ── Info card grid ─────────────────────────────────────────────────
	cardGrid: {
		flexDirection: "row",
		gap: 12,
	},
	card: {
		flex: 1,
		backgroundColor: colors.slate50,
		borderRadius: 4,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	cardTitle: {
		fontSize: 7,
		color: colors.slate500,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		fontWeight: 500,
		marginBottom: 8,
	},
	cardPrimary: {
		fontSize: 12,
		fontWeight: 700,
		color: colors.slate900,
		marginBottom: 6,
	},
	cardLine: {
		fontSize: 9,
		color: colors.slate600,
	},

	// ── KV pairs (compact, inline) ─────────────────────────────────────
	kvRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5.5,
		borderBottomWidth: 0.5,
		borderBottomColor: colors.hairline,
	},
	kvRowLast: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5.5,
	},
	kvLabel: {
		fontSize: 8.5,
		color: colors.slate500,
		fontWeight: 500,
	},
	kvValue: {
		fontSize: 9.5,
		color: colors.slate900,
		fontWeight: 700,
	},

	// ── Highlight box (listing price / size) ───────────────────────────
	highlightRow: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 6,
	},
	highlightBox: {
		flex: 1,
		borderRadius: 4,
		paddingVertical: 14,
		paddingHorizontal: 16,
		alignItems: "flex-start",
	},
	highlightLabel: {
		fontSize: 7,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		fontWeight: 500,
		marginBottom: 6,
	},
	highlightValue: {
		fontSize: 20,
		fontWeight: 700,
	},
	highlightCurrency: {
		fontSize: 9,
		fontWeight: 700,
		color: colors.slate500,
		marginLeft: 4,
	},

	// ── Clauses list ───────────────────────────────────────────────────
	// Hanging-indent rows separated by hairlines; the number carries the
	// accent color (set inline from the palette). No zebra banding.
	clauseRow: {
		flexDirection: "row",
		paddingVertical: 7,
		alignItems: "flex-start",
		borderBottomWidth: 0.5,
		borderBottomColor: colors.hairline,
	},
	clauseRowLast: {
		flexDirection: "row",
		paddingVertical: 7,
		alignItems: "flex-start",
	},
	clauseNumber: {
		width: 24,
		fontSize: 9,
		fontWeight: 700,
	},
	clauseText: {
		flex: 1,
		fontSize: 9,
		color: colors.slate700,
	},

	// ── Signatures ─────────────────────────────────────────────────────
	signatureRow: {
		flexDirection: "row",
		gap: 32,
		marginTop: 12,
	},
	signatureBox: {
		flex: 1,
		paddingTop: 34,
	},
	signatureLine: {
		borderBottomWidth: 1,
		borderBottomColor: colors.slate800,
		marginBottom: 6,
	},
	signatureLabel: {
		fontSize: 8.5,
		color: colors.slate900,
		fontWeight: 700,
	},
	signatureSubLabel: {
		fontSize: 7.5,
		color: colors.slate500,
		marginTop: 2,
	},
	signatureHint: {
		fontSize: 6.5,
		color: colors.slate400,
		marginTop: 3,
	},

	// ── Footer ─────────────────────────────────────────────────────────
	footer: {
		position: "absolute",
		bottom: FOOTER_BOTTOM,
		left: PAGE_PADDING,
		right: PAGE_PADDING,
		height: FOOTER_HEIGHT,
		borderTopWidth: 0.5,
		borderTopColor: colors.hairline,
		paddingTop: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	footerText: {
		fontSize: 7,
		color: colors.slate500,
		fontWeight: 500,
	},
	pageNumber: {
		fontSize: 7,
		color: colors.slate500,
		fontWeight: 500,
	},

	// ── Agreement title bar ────────────────────────────────────────────
	// Full-bleed brand bar across the very top of the body page.
	docHero: {
		paddingVertical: 16,
		paddingHorizontal: PAGE_PADDING, // align inner text with the body column
		marginHorizontal: -PAGE_PADDING, // bleed to the page edge
		marginTop: -PAGE_PADDING,
		marginBottom: 24,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	docHeroTitle: {
		fontSize: 15,
		fontWeight: 700,
		color: colors.white,
		letterSpacing: 0.2,
	},
	docHeroDate: {
		fontSize: 7.5,
		fontWeight: 500,
	},

	// ── Section chip ───────────────────────────────────────────────────
	// Accent square + tracked label. Replaces the old solid navy box.
	chipRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	chipSquare: {
		width: 7,
		height: 7,
		marginRight: 7,
	},
	chipText: {
		fontSize: 8.5,
		fontWeight: 700,
		letterSpacing: 1.1,
		textTransform: "uppercase",
	},

	// ── Party card ─────────────────────────────────────────────────────
	// Full hairline border (no accent side-stripe). Role identity is carried
	// by a small tinted square with the role initial, not a colored border.
	// No `flex` here: the card sizes to its content height and gets full width
	// from the parent column's default `alignItems: stretch`. A `flex: 1`
	// would expand to flexBasis:0 and, under the fixed-height A4 Page,
	// collapse the box shorter than its stacked fields (overflow + overlap).
	partyCard: {
		borderWidth: 0.75,
		borderColor: colors.hairline,
		borderRadius: 3,
		paddingVertical: 11,
		paddingHorizontal: 12,
	},
	partyCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	partyInitial: {
		width: 18,
		height: 18,
		borderRadius: 2,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 8,
	},
	partyInitialText: {
		fontSize: 9,
		fontWeight: 700,
	},
	partyName: {
		fontSize: 11,
		fontWeight: 700,
		color: colors.slate900,
	},
	partyRole: {
		fontSize: 7,
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: 1,
	},
	// Each field is wrapped in a View with a minHeight floor (mirroring
	// propGridCell). Defense-in-depth against the lineHeight-compounding bug
	// fixed on `styles.page`: View minHeight is unaffected by text relayout, so
	// a row can never collapse to zero height. Floors comfortably exceed
	// single-line glyph heights (no clipping), and minHeight does not cap
	// growth, so wrapping addresses still expand to fit.
	partyFieldRow: {
		flexDirection: "row",
		minHeight: 14,
		marginBottom: 3,
	},
	partyFieldLabel: {
		width: 78,
		fontSize: 7.5,
		fontWeight: 500,
		color: colors.slate500,
		paddingTop: 1,
	},
	partyFieldValue: {
		flex: 1,
		fontSize: 9,
		color: colors.slate800,
	},

	// ── Property block — single full-width card with 4-col KV grid ─────
	propBlock: {
		borderWidth: 0.75,
		borderColor: colors.hairline,
		borderRadius: 3,
		padding: 12,
	},
	propAddressLabel: {
		fontSize: 7,
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: 3,
	},
	propAddressValue: {
		fontSize: 11,
		fontWeight: 700,
		color: colors.slate900,
		marginBottom: 10,
	},
	propGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	propGridCell: {
		width: "25%",          // 4 columns
		paddingRight: 8,
		marginBottom: 6,
		minHeight: 32,
	},
	propGridLabel: {
		fontSize: 6.5,
		fontWeight: 500,
		color: colors.slate500,
		marginBottom: 2,
	},
	propGridValue: {
		fontSize: 9.5,
		color: colors.slate800,
		fontWeight: 500,
	},

	// ── Table (utilities / inventory / commission) ─────────────────────
	table: {
		borderWidth: 0.5,
		borderColor: colors.hairline,
		borderRadius: 3,
	},
	tableHeaderRow: {
		flexDirection: "row",
	},
	tableHeaderCell: {
		flex: 1,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 7,
		fontWeight: 700,
		color: colors.white,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	tableRow: {
		flexDirection: "row",
		borderTopWidth: 0.5,
		borderTopColor: colors.hairline,
	},
	tableLabelCell: {
		flex: 1.2,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 8.5,
		fontWeight: 700,
	},
	tableDataCell: {
		flex: 1,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 8.5,
		color: colors.slate800,
	},

	// ── Money pair (rent+deposit / price+kapora) ───────────────────────
	moneyBoxFilled: {
		flex: 1,
		borderRadius: 3,
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	moneyBoxOutlined: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 3,
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	moneyLabel: {
		fontSize: 7,
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		marginBottom: 6,
	},
	moneyValue: {
		fontSize: 20,
		fontWeight: 700,
	},
	moneyCurrency: {
		fontSize: 9,
		fontWeight: 700,
		marginLeft: 4,
	},

	// ── Callout (note / warning) ───────────────────────────────────────
	callout: {
		borderRadius: 3,
		paddingVertical: 9,
		paddingHorizontal: 12,
		marginTop: 8,
	},
	calloutText: {
		fontSize: 8.5,
	},

	// Centered connective line (e.g. the "yetkilendiren MAL SAHİBİ" sentence).
	connectiveLine: {
		fontSize: 8,
		color: colors.slate600,
		textAlign: "center",
		marginTop: 12,
		marginBottom: 4,
	},
});
