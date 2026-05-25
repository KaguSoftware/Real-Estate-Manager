import { StyleSheet, Font } from "@react-pdf/renderer";

// Prevent word hyphenation in @react-pdf/renderer
Font.registerHyphenationCallback((word) => [word]);

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
} as const;

export const styles = StyleSheet.create({
	page: {
		paddingTop: 48,
		paddingBottom: 60,
		paddingHorizontal: 48,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: colors.slate800,
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
		fontFamily: "Helvetica-Bold",
		color: colors.slate900,
		letterSpacing: 1.2,
		marginBottom: 2,
	},
	refLine: {
		fontSize: 7.5,
		color: colors.slate500,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		fontFamily: "Helvetica-Bold",
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
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	heroAddress: {
		fontSize: 13,
		fontFamily: "Helvetica-Bold",
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
		marginBottom: 18,
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
		fontFamily: "Helvetica-Bold",
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
		lineHeight: 1.55,
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
		fontFamily: "Helvetica-Bold",
		marginBottom: 8,
	},
	cardPrimary: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
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
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	kvValue: {
		fontSize: 9.5,
		color: colors.slate900,
		fontFamily: "Helvetica-Bold",
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
		fontFamily: "Helvetica-Bold",
		marginBottom: 6,
	},
	highlightValue: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		color: colors.slate900,
	},
	highlightCurrency: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
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
		fontFamily: "Helvetica-Bold",
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
		fontSize: 7,
		color: colors.slate500,
		textTransform: "uppercase",
		letterSpacing: 1.5,
		fontFamily: "Helvetica-Bold",
	},
	signatureSubLabel: {
		fontSize: 7,
		color: colors.slate400,
		marginTop: 2,
	},

	// ── Footer ─────────────────────────────────────────────────────────
	footer: {
		position: "absolute",
		bottom: 24,
		left: 48,
		right: 48,
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
		fontFamily: "Helvetica-Bold",
	},
	pageNumber: {
		fontSize: 7,
		color: colors.slate400,
		fontFamily: "Helvetica-Bold",
	},
});
