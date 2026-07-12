// Branded cover page — first page of every generated document. A full-height
// brand rail on the left edge, the team identity top-left, an oversized
// left-aligned title and a borderless key-facts grid, all tinted with the
// team's palette so the cover and the body pages read as one document.

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
	// Full-height brand rail bleeding off the left page edge. Absolutely
	// positioned with negative offsets so it spans the entire page height
	// regardless of the padded content column (same bleed technique as the
	// agreement title bar's negative margins).
	rail: {
		position: "absolute",
		left: -PAGE_PADDING,
		top: -PAGE_PADDING,
		bottom: -PAGE_PADDING_BOTTOM,
		width: 10,
	},
	railAccent: {
		position: "absolute",
		left: -PAGE_PADDING + 10,
		top: -PAGE_PADDING,
		bottom: -PAGE_PADDING_BOTTOM,
		width: 3,
	},
	logoWrap: {
		alignItems: "flex-start",
		marginTop: 6,
	},
	logo: {
		maxHeight: 64,
		maxWidth: 200,
		objectFit: "contain",
	},
	teamName: {
		fontSize: 10,
		fontWeight: 700,
		letterSpacing: 1.5,
		textTransform: "uppercase",
		color: colors.slate600,
		marginTop: 8,
	},
	// When there is no logo, the team name becomes the visual anchor.
	teamNameBig: {
		fontSize: 20,
		fontWeight: 700,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	titleBlock: {
		alignItems: "flex-start",
	},
	titleLabel: {
		fontSize: 8,
		fontWeight: 500,
		letterSpacing: 2,
		textTransform: "uppercase",
		color: colors.slate500,
		marginBottom: 12,
	},
	title: {
		fontSize: 34,
		fontWeight: 700,
		letterSpacing: -0.5,
		// Keep long titles ("Satılık Alım, Satış Sözleşmesi") to a tight
		// two-line stack instead of running edge to edge.
		maxWidth: 400,
	},
	subtitle: {
		fontSize: 11,
		fontWeight: 500,
		color: colors.slate600,
		marginTop: 8,
	},
	titleRule: {
		width: 64,
		height: 3,
		marginTop: 18,
	},
	// Borderless facts grid: hairline row rules only.
	infoBlock: {
		marginTop: 36,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingVertical: 8,
		borderBottomWidth: 0.5,
		borderBottomColor: colors.hairline,
	},
	infoRowLast: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingVertical: 8,
	},
	infoLabel: {
		fontSize: 8.5,
		fontWeight: 500,
		color: colors.slate500,
		marginRight: 16,
	},
	infoValue: {
		flex: 1,
		fontSize: 10.5,
		fontWeight: 700,
		color: colors.slate900,
		textAlign: "right",
	},
	// Full-bleed footer band pinned to the bottom of the cover, with a thin
	// accent border on top.
	footerBand: {
		marginHorizontal: -PAGE_PADDING,
		marginBottom: -PAGE_PADDING_BOTTOM,
		paddingVertical: 16,
		paddingHorizontal: PAGE_PADDING,
		borderTopWidth: 3,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	footerText: {
		fontSize: 7.5,
		fontWeight: 500,
		color: colors.white,
		letterSpacing: 1.2,
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
			<View style={[cover.rail, { backgroundColor: palette.primary }]} />
			<View style={[cover.railAccent, { backgroundColor: palette.accent }]} />

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

			<View style={{ flexGrow: 1.4 }} />

			<View style={cover.titleBlock}>
				<Text style={cover.titleLabel}>Belge</Text>
				<Text style={[cover.title, { color: palette.primary }]}>{title}</Text>
				{subtitle ? <Text style={cover.subtitle}>{subtitle}</Text> : null}
				<View style={[cover.titleRule, { backgroundColor: palette.accent }]} />
			</View>

			{items.length > 0 ? (
				<View style={cover.infoBlock}>
					{items.map((it, i) => (
						<View key={i} style={i === items.length - 1 ? cover.infoRowLast : cover.infoRow}>
							<Text style={cover.infoLabel}>{it.label}</Text>
							<Text style={cover.infoValue}>{it.value}</Text>
						</View>
					))}
				</View>
			) : null}

			<View style={{ flexGrow: 2 }} />

			<View style={[cover.footerBand, { backgroundColor: palette.primary, borderTopColor: palette.accent }]}>
				<Text style={cover.footerText}>{teamName}</Text>
				<Text style={cover.footerText}>{formatDate(generatedAt)}</Text>
			</View>
		</View>
	);
}
