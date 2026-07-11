// Branded cover page — first page of every generated document. Shows the team
// logo, the document title and a card of key facts, all tinted with the team's
// brand palette so the cover and the body pages read as one document.

import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { colors, PAGE_PADDING, PAGE_PADDING_BOTTOM } from "../styles";
import { useBranding } from "../branding";
import { formatDate } from "./common";

export interface CoverInfoItem {
	label: string;
	value: string;
}

const cover = StyleSheet.create({
	root: {
		height: "100%",
		flexDirection: "column",
	},
	// Full-bleed brand bands at the very top of the page.
	bandPrimary: {
		marginTop: -PAGE_PADDING,
		marginHorizontal: -PAGE_PADDING,
		height: 10,
	},
	bandAccent: {
		marginHorizontal: -PAGE_PADDING,
		height: 4,
	},
	logoWrap: {
		alignItems: "center",
		marginTop: 8,
	},
	logo: {
		maxHeight: 72,
		maxWidth: 220,
		objectFit: "contain",
	},
	teamName: {
		fontSize: 11,
		fontWeight: 700,
		letterSpacing: 2,
		textTransform: "uppercase",
		color: colors.slate600,
		marginTop: 10,
	},
	// When there is no logo, the team name becomes the visual anchor.
	teamNameBig: {
		fontSize: 22,
		fontWeight: 700,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
	titleBlock: {
		alignItems: "center",
	},
	titleLabel: {
		fontSize: 8,
		fontWeight: 500,
		letterSpacing: 2.5,
		textTransform: "uppercase",
		color: colors.slate400,
		marginBottom: 10,
	},
	title: {
		fontSize: 26,
		fontWeight: 700,
		textAlign: "center",
		letterSpacing: 0.5,
	},
	subtitle: {
		fontSize: 10,
		fontWeight: 500,
		color: colors.slate500,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		marginTop: 6,
	},
	titleRule: {
		width: 56,
		height: 3,
		marginTop: 16,
	},
	infoCard: {
		marginTop: 32,
		borderWidth: 0.75,
		borderLeftWidth: 3,
		paddingVertical: 14,
		paddingHorizontal: 18,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingVertical: 6,
		borderBottomWidth: 0.5,
		borderBottomColor: colors.slate100,
	},
	infoRowLast: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingVertical: 6,
	},
	infoLabel: {
		fontSize: 8,
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: 1,
		color: colors.slate500,
		marginRight: 16,
	},
	infoValue: {
		flex: 1,
		fontSize: 10,
		fontWeight: 700,
		color: colors.slate900,
		textAlign: "right",
	},
	// Full-bleed footer band pinned to the bottom of the cover.
	footerBand: {
		marginHorizontal: -PAGE_PADDING,
		marginBottom: -PAGE_PADDING_BOTTOM,
		paddingVertical: 16,
		paddingHorizontal: PAGE_PADDING,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	footerText: {
		fontSize: 7.5,
		fontWeight: 500,
		color: colors.white,
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
});

export function CoverPage({
	title,
	subtitle,
	info,
	generatedAt,
}: {
	title: string;
	subtitle?: string;
	info: CoverInfoItem[];
	generatedAt?: string;
}) {
	const { teamName, logoDataUrl, palette } = useBranding();
	const items = info.filter((it) => it.value && it.value.trim());

	return (
		<View style={cover.root}>
			<View style={[cover.bandPrimary, { backgroundColor: palette.primary }]} />
			<View style={[cover.bandAccent, { backgroundColor: palette.accent }]} />

			<View style={{ flexGrow: 1.2 }} />

			<View style={cover.logoWrap}>
				{logoDataUrl ? (
					<>
						{/* eslint-disable-next-line jsx-a11y/alt-text */}
						<Image src={logoDataUrl} style={cover.logo} />
						<Text style={cover.teamName}>{teamName}</Text>
					</>
				) : (
					<Text style={[cover.teamNameBig, { color: palette.primary }]}>{teamName}</Text>
				)}
			</View>

			<View style={{ flexGrow: 1 }} />

			<View style={cover.titleBlock}>
				<Text style={cover.titleLabel}>Belge / Document</Text>
				<Text style={[cover.title, { color: palette.primary }]}>{title}</Text>
				{subtitle ? <Text style={cover.subtitle}>{subtitle}</Text> : null}
				<View style={[cover.titleRule, { backgroundColor: palette.accent }]} />
			</View>

			{items.length > 0 ? (
				<View style={[cover.infoCard, { borderColor: palette.muted, borderLeftColor: palette.primary }]}>
					{items.map((it, i) => (
						<View key={i} style={i === items.length - 1 ? cover.infoRowLast : cover.infoRow}>
							<Text style={cover.infoLabel}>{it.label}</Text>
							<Text style={cover.infoValue}>{it.value}</Text>
						</View>
					))}
				</View>
			) : null}

			<View style={{ flexGrow: 2 }} />

			<View style={[cover.footerBand, { backgroundColor: palette.primary }]}>
				<Text style={cover.footerText}>{teamName}</Text>
				<Text style={cover.footerText}>{formatDate(generatedAt)}</Text>
			</View>
		</View>
	);
}
