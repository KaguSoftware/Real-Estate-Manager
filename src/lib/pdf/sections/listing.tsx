import { View, Text, Image } from "@react-pdf/renderer";
import {
	DocHeader,
	HeroAddress,
	SectionTitle,
	KVList,
	HighlightPair,
	TextSection,
	PageFooter,
	formatDate,
} from "./common";
import type { ListingPDFData } from "../types";
import { styles, colors } from "../styles";

const fmtMoney = (n: number) =>
	n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function PropertyListing({ data }: { data: ListingPDFData }) {
	const {
		address_line, city, listing_type, nitelik, bedrooms, bathrooms,
		size_sqm, list_price, currency, notes, images, generatedAt,
	} = data;

	const [hero, ...rest] = images;

	const typeLabel = listing_type === "for_rent" ? "For Rent" : "For Sale";
	const heroMeta = [city, typeLabel].filter(Boolean).join("  •  ");

	const facts: { label: string; value: string }[] = [];
	if (nitelik) facts.push({ label: "Type", value: nitelik });
	if (bedrooms != null || bathrooms != null)
		facts.push({ label: "Bedrooms / Baths", value: `${bedrooms ?? "—"} / ${bathrooms ?? "—"}` });
	if (size_sqm != null) facts.push({ label: "Size", value: `${size_sqm} m²` });
	facts.push({ label: "Listing", value: typeLabel });

	return (
		<View>
			<DocHeader
				title="Property Listing"
				subtitle={`Prepared ${formatDate(generatedAt)}`}
			/>

			<HeroAddress address={address_line} meta={heroMeta || undefined} />

			{/* Photos first — hero, then a grid of the rest. */}
			{hero ? (
				<View style={styles.section}>
					{/* eslint-disable-next-line jsx-a11y/alt-text */}
					<Image src={hero} style={listingStyles.heroImage} />
					{rest.length > 0 && (
						<View style={listingStyles.thumbGrid}>
							{rest.map((url, i) => (
								// eslint-disable-next-line jsx-a11y/alt-text
								<Image key={i} src={url} style={listingStyles.thumb} />
							))}
						</View>
					)}
				</View>
			) : null}

			{/* Price highlight */}
			{list_price != null && (
				<View style={styles.section} wrap={false}>
					<SectionTitle title={listing_type === "for_rent" ? "Monthly Rent" : "Price"} />
					<HighlightPair
						left={{
							label: listing_type === "for_rent" ? "Monthly Rent" : "Asking Price",
							value: fmtMoney(list_price),
							currency,
						}}
						right={{
							label: "Size",
							value: size_sqm != null ? `${size_sqm}` : "—",
							currency: size_sqm != null ? "m²" : "",
						}}
					/>
				</View>
			)}

			{/* Details */}
			<View style={styles.section} wrap={false}>
				<SectionTitle title="Details" />
				<KVList items={facts} />
			</View>

			{/* Description */}
			{notes && notes.trim() ? (
				<TextSection label="Description" text={notes} />
			) : null}

			<PageFooter />
		</View>
	);
}

import { StyleSheet } from "@react-pdf/renderer";

const listingStyles = StyleSheet.create({
	heroImage: {
		width: "100%",
		height: 260,
		objectFit: "cover",
		borderRadius: 4,
		marginBottom: 8,
		backgroundColor: colors.slate100,
	},
	thumbGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	thumb: {
		width: "31.8%",
		height: 90,
		objectFit: "cover",
		borderRadius: 3,
		backgroundColor: colors.slate100,
	},
});
