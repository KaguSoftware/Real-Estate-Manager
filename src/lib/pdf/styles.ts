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
	// Avera brand palette — used by the sales agreement only.
	navy_brand: "#051526",
	gray_brand: "#9D9F9E",
	red_brand:  "#B11211",
	navy_brand_dark: "#020a13",
	navy_brand_tint: "#e8ebef",
} as const;

export const styles = StyleSheet.create({
	page: {
		paddingTop: PAGE_PADDING,
		paddingBottom: PAGE_PADDING_BOTTOM, // reserves room for the fixed footer
		paddingHorizontal: PAGE_PADDING,
		fontFamily: "Sans",
		fontSize: 10,
		color: colors.slate800,
		lineHeight: 1.5,
		backgroundColor: colors.white,
	},

	// ── Header ─────────────────────────────────────────────────────────
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		marginBottom: 10,
	},
	docType: {
		fontSize: 20,
		fontWeight: "bold",
		color: colors.slate900,
		letterSpacing: 1.2,
		marginBottom: 2,
	},
	refLine: {
		fontSize: 7.5,
		color: colors.slate500,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		fontWeight: "bold",
	},
	dividerThin: {
		width: "100%",
		height: 1,
		backgroundColor: colors.slate900,
		marginBottom: 22,
	},

	// ── Hero card (property address up top) ────────────────────────────
	hero: {
		backgroundColor: colors.slate50,
		borderLeftWidth: 3,
		borderLeftColor: colors.slate900,
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginBottom: 22,
	},
	heroLabel: {
		fontSize: 7,
		color: colors.slate400,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: 500,
		marginBottom: 5,
	},
	heroAddress: {
		fontSize: 14,
		fontWeight: "bold",
		color: colors.slate900,
		lineHeight: 1.35,
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
		fontSize: 8,
		color: colors.slate500,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: 500,
	},
	sectionRule: {
		flex: 1,
		height: 0.5,
		backgroundColor: colors.slate200,
		marginLeft: 10,
	},
	bodyText: {
		fontSize: 9.5,
		color: colors.slate700,
		lineHeight: 1.5,
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
		color: colors.slate400,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: 500,
		marginBottom: 8,
	},
	cardPrimary: {
		fontSize: 12,
		fontWeight: "bold",
		color: colors.slate900,
		marginBottom: 6,
		lineHeight: 1.3,
	},
	cardLine: {
		fontSize: 9,
		color: colors.slate600,
		lineHeight: 1.45,
	},

	// ── KV pairs (compact, inline) ─────────────────────────────────────
	kvRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5,
		borderBottomWidth: 0.5,
		borderBottomColor: colors.slate100,
	},
	kvRowLast: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5,
	},
	kvLabel: {
		fontSize: 8.5,
		color: colors.slate500,
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	kvValue: {
		fontSize: 9.5,
		color: colors.slate900,
		fontWeight: "bold",
	},

	// ── Highlight box (rent + deposit) ─────────────────────────────────
	highlightRow: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 6,
	},
	highlightBox: {
		flex: 1,
		backgroundColor: colors.indigo50,
		borderRadius: 4,
		paddingVertical: 14,
		paddingHorizontal: 16,
		alignItems: "flex-start",
	},
	highlightLabel: {
		fontSize: 7,
		color: colors.indigo500,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: 500,
		marginBottom: 6,
	},
	highlightValue: {
		fontSize: 18,
		fontWeight: "bold",
		color: colors.slate900,
	},
	highlightCurrency: {
		fontSize: 9,
		fontWeight: "bold",
		color: colors.slate500,
		marginLeft: 4,
	},

	// ── Clauses list ───────────────────────────────────────────────────
	clauseRow: {
		flexDirection: "row",
		paddingVertical: 7,
		paddingHorizontal: 12,
		alignItems: "flex-start",
	},
	clauseRowAlt: {
		flexDirection: "row",
		paddingVertical: 7,
		paddingHorizontal: 12,
		alignItems: "flex-start",
		backgroundColor: colors.slate50,
	},
	clauseNumber: {
		width: 22,
		fontSize: 9,
		fontWeight: "bold",
		color: colors.slate400,
	},
	clauseText: {
		flex: 1,
		fontSize: 9,
		color: colors.slate700,
		lineHeight: 1.5,
	},

	// ── Signatures ─────────────────────────────────────────────────────
	signatureRow: {
		flexDirection: "row",
		gap: 32,
		marginTop: 12,
	},
	signatureBox: {
		flex: 1,
		paddingTop: 30,
	},
	signatureLine: {
		borderBottomWidth: 1,
		borderBottomColor: colors.slate800,
		marginBottom: 6,
	},
	signatureLabel: {
		fontSize: 7.5,
		color: colors.slate600,
		textTransform: "uppercase",
		letterSpacing: 1.2,
		fontWeight: 700,
	},
	signatureSubLabel: {
		fontSize: 7,
		color: colors.slate400,
		marginTop: 2,
	},

	// ── Footer ─────────────────────────────────────────────────────────
	footer: {
		position: "absolute",
		bottom: FOOTER_BOTTOM,
		left: PAGE_PADDING,
		right: PAGE_PADDING,
		height: FOOTER_HEIGHT,
		borderTopWidth: 0.5,
		borderTopColor: colors.slate200,
		paddingTop: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	footerText: {
		fontSize: 6.5,
		color: colors.slate400,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontWeight: 500,
	},
	pageNumber: {
		fontSize: 7,
		color: colors.slate400,
		fontWeight: 500,
	},

	// ── Sales agreement — Avera branding ──────────────────────────────
	// Hero title bar across the very top of page 1.
	salesHero: {
		backgroundColor: colors.navy_brand,
		paddingVertical: 16,
		paddingHorizontal: PAGE_PADDING, // align inner text with the body column
		marginHorizontal: -PAGE_PADDING, // bleed to the page edge
		marginTop: -PAGE_PADDING,
		marginBottom: 24,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	salesHeroTitle: {
		fontSize: 14,
		fontWeight: "bold",
		color: colors.white,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
	salesHeroDate: {
		fontSize: 7.5,
		fontWeight: 500,
		color: colors.gray_brand,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},

	// Navy chip used as the label for sections A, B, C, D, E.
	salesSectionChip: {
		alignSelf: "flex-start",
		backgroundColor: colors.navy_brand,
		paddingVertical: 4,
		paddingHorizontal: 10,
		marginBottom: 8,
	},
	salesSectionChipText: {
		fontSize: 8,
		fontWeight: "bold",
		color: colors.white,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},

	// Sales card — replaces the default gray Card on sales pages.
	salesCard: {
		flex: 1,
		borderWidth: 0.75,
		borderColor: colors.gray_brand,
		borderLeftWidth: 3,
		borderLeftColor: colors.navy_brand,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	salesCardLabel: {
		fontSize: 6.5,
		fontWeight: 500,
		color: colors.navy_brand,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		marginBottom: 3,
	},
	salesCardValue: {
		fontSize: 9.5,
		color: colors.slate900,
		fontWeight: "bold",
		marginBottom: 6,
		lineHeight: 1.3,
	},
	salesCardLine: {
		fontSize: 8.5,
		color: colors.slate700,
		marginBottom: 3,
		lineHeight: 1.4,
	},

	// Property "C" block — single full-width card with 4-col KV grid.
	propBlock: {
		borderWidth: 0.75,
		borderColor: colors.gray_brand,
		borderLeftWidth: 3,
		borderLeftColor: colors.navy_brand,
		padding: 12,
	},
	propAddressLabel: {
		fontSize: 6.5,
		fontWeight: 500,
		color: colors.navy_brand,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		marginBottom: 3,
	},
	propAddressValue: {
		fontSize: 10,
		fontWeight: "bold",
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
		fontSize: 6,
		fontWeight: 500,
		color: colors.gray_brand,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 2,
		lineHeight: 1.2,
	},
	propGridValue: {
		fontSize: 9,
		color: colors.slate800,
		lineHeight: 1.35,
	},

	// Commission table (E).
	commissionTable: {
		borderWidth: 0.5,
		borderColor: colors.gray_brand,
	},
	commissionHeaderRow: {
		flexDirection: "row",
		backgroundColor: colors.navy_brand,
	},
	commissionHeaderCell: {
		flex: 1,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 7,
		fontWeight: "bold",
		color: colors.white,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		lineHeight: 1.25,
		borderRightWidth: 0.5,
		borderRightColor: colors.navy_brand_dark,
	},
	commissionHeaderCellLeft: {
		flex: 1.2,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 7,
		fontWeight: "bold",
		color: colors.white,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		lineHeight: 1.25,
		borderRightWidth: 0.5,
		borderRightColor: colors.navy_brand_dark,
	},
	commissionRow: {
		flexDirection: "row",
		borderTopWidth: 0.5,
		borderTopColor: colors.gray_brand,
	},
	commissionRowAlt: {
		flexDirection: "row",
		borderTopWidth: 0.5,
		borderTopColor: colors.gray_brand,
		backgroundColor: colors.navy_brand_tint,
	},
	commissionLabelCell: {
		flex: 1.2,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 8,
		fontWeight: "bold",
		color: colors.navy_brand,
		lineHeight: 1.3,
		borderRightWidth: 0.5,
		borderRightColor: colors.gray_brand,
	},
	commissionDataCell: {
		flex: 1,
		paddingVertical: 6,
		paddingHorizontal: 8,
		fontSize: 8,
		color: colors.slate800,
		lineHeight: 1.3,
		borderRightWidth: 0.5,
		borderRightColor: colors.gray_brand,
		textAlign: "right",
	},

	// Sale price / kapora pair — replaces HighlightPair on sales.
	salesPriceBox: {
		flex: 1,
		backgroundColor: colors.navy_brand,
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	salesPriceLabel: {
		fontSize: 7,
		fontWeight: 500,
		color: colors.gray_brand,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		marginBottom: 6,
	},
	salesPriceValue: {
		fontSize: 18,
		fontWeight: "bold",
		color: colors.white,
	},
	salesDepositBox: {
		flex: 1,
		borderWidth: 1,
		borderColor: colors.red_brand,
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	salesDepositLabel: {
		fontSize: 7,
		fontWeight: 500,
		color: colors.red_brand,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		marginBottom: 6,
	},
	salesDepositValue: {
		fontSize: 18,
		fontWeight: "bold",
		color: colors.navy_brand,
	},
	salesCurrencyTag: {
		fontSize: 9,
		fontWeight: "bold",
		marginLeft: 4,
	},

	// Tax responsibility tag below the price boxes.
	avaraLine: {
		fontSize: 8,
		color: colors.slate600,
		textAlign: "center",
		marginTop: 12,
		marginBottom: 4,
	},

	// Signature accent bar (rendered below each signature label when SignatureBlock
	// receives an accentColor prop).
	signatureAccentBar: {
		height: 5,
		marginTop: 4,
	},
});
