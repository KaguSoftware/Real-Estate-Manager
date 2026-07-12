// Client-facing property listing — photo-first, magazine-style page shared
// with clients (e.g. over WhatsApp) instead of typing out details.

import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { useBranding } from "../branding";
import { TextSection, SectionTitle, fmtMoney } from "./common";
import type { ListingPDFData } from "../types";
import { styles, colors, PAGE_PADDING } from "../styles";

export function PropertyListing({ data }: { data: ListingPDFData }) {
	const {
		address_line, city, listing_type, nitelik, bedrooms, bathrooms,
		size_sqm, list_price, currency, notes, images,
	} = data;
	const { palette } = useBranding();

	const [hero, ...rest] = images;
	const typeLabel = listing_type === "for_rent" ? "Kiralık" : "Satılık";
	const priceLabel = listing_type === "for_rent" ? "Aylık Kira" : "Satış Fiyatı";

	const stats: { label: string; value: string }[] = [];
	if (size_sqm != null) stats.push({ label: "Yüz Ölçümü", value: `${size_sqm} m²` });
	if (nitelik) stats.push({ label: "Nitelik", value: nitelik });
	if (bedrooms != null) stats.push({ label: "Oda", value: String(bedrooms) });
	if (bathrooms != null) stats.push({ label: "Banyo", value: String(bathrooms) });

	return (
		<View>
			{/* Full-bleed hero photo, edge to edge. */}
			{hero ? (
				// eslint-disable-next-line jsx-a11y/alt-text
				<Image src={hero} style={ls.heroImage} />
			) : null}

			{/* Full-bleed brand band: address + type chip left, price right. */}
			<View style={[ls.band, { backgroundColor: palette.primary }, hero ? {} : { marginTop: -PAGE_PADDING }]}>
				<View style={{ flex: 1, marginRight: 16 }}>
					<View style={[ls.typeChip, { backgroundColor: palette.accent }]}>
						<Text style={ls.typeChipText}>{typeLabel}</Text>
					</View>
					<Text style={ls.bandAddress}>{address_line}</Text>
					{city ? <Text style={[ls.bandCity, { color: palette.muted }]}>{city}</Text> : null}
				</View>
				{list_price != null ? (
					<View style={{ alignItems: "flex-end" }}>
						<Text style={[styles.moneyLabel, { color: palette.muted }]}>{priceLabel}</Text>
						<View style={{ flexDirection: "row", alignItems: "baseline" }}>
							<Text style={[styles.moneyValue, { fontSize: 22, color: colors.white }]}>{fmtMoney(list_price)}</Text>
							<Text style={[styles.moneyCurrency, { color: palette.muted }]}>{currency}</Text>
						</View>
					</View>
				) : null}
			</View>

			{/* Stat tiles */}
			{stats.length > 0 ? (
				<View style={ls.statRow} wrap={false}>
					{stats.map((s, i) => (
						<View key={i} style={[ls.statTile, { backgroundColor: palette.tint }]}>
							<Text style={[ls.statValue, { color: palette.primary }]}>{s.value}</Text>
							<Text style={ls.statLabel}>{s.label}</Text>
						</View>
					))}
				</View>
			) : null}

			{/* Remaining photos */}
			{rest.length > 0 ? (
				<View style={styles.section}>
					<SectionTitle title="Fotoğraflar" />
					<View style={ls.thumbGrid}>
						{rest.map((url, i) => (
							// eslint-disable-next-line jsx-a11y/alt-text
							<Image key={i} src={url} style={ls.thumb} />
						))}
					</View>
				</View>
			) : null}

			{/* Description */}
			{notes && notes.trim() ? (
				<TextSection label="Açıklama" text={notes} />
			) : null}
		</View>
	);
}

const ls = StyleSheet.create({
	heroImage: {
		marginTop: -PAGE_PADDING,
		marginHorizontal: -PAGE_PADDING,
		width: PAGE_PADDING * 2 + 499, // A4 width 595pt = content 499 + 2×48 padding
		height: 250,
		objectFit: "cover",
		backgroundColor: colors.slate100,
	},
	band: {
		marginHorizontal: -PAGE_PADDING,
		paddingVertical: 16,
		paddingHorizontal: PAGE_PADDING,
		marginBottom: 20,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	typeChip: {
		alignSelf: "flex-start",
		paddingVertical: 2.5,
		paddingHorizontal: 7,
		borderRadius: 2,
		marginBottom: 6,
	},
	typeChipText: {
		fontSize: 7,
		fontWeight: 700,
		color: colors.white,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	bandAddress: {
		fontSize: 14,
		fontWeight: 700,
		color: colors.white,
	},
	bandCity: {
		fontSize: 9,
		fontWeight: 500,
		marginTop: 2,
	},
	statRow: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 20,
	},
	statTile: {
		flex: 1,
		borderRadius: 3,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	statValue: {
		fontSize: 14,
		fontWeight: 700,
	},
	statLabel: {
		fontSize: 7,
		fontWeight: 500,
		color: colors.slate500,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginTop: 2,
	},
	thumbGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
	},
	thumb: {
		// Clean 3-up: 3×32% = 96% + two 6pt gaps fit comfortably in the column.
		width: "32%",
		height: 84,
		objectFit: "cover",
		borderRadius: 3,
		backgroundColor: colors.slate100,
	},
});
