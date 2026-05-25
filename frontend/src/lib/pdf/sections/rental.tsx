import { View } from "@react-pdf/renderer";
import {
	DocHeader,
	HeroAddress,
	SectionTitle,
	TextSection,
	ClausesList,
	SignatureBlock,
	PageFooter,
	CardGrid,
	Card,
	KVList,
	HighlightPair,
	formatDate,
} from "./common";
import { RENTAL_STANDARD_CLAUSES, interpolate } from "../rentalClauses";
import type { RentalPDFData } from "../types";
import { styles } from "../styles";

const termLabel = (t: RentalPDFData["lease"]["term"]) =>
	t === "1yr" ? "1 Year" : t === "2yr" ? "2 Years" : "Open-ended";

const fmtMoney = (n: number) =>
	n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function RentalAgreement({ data }: { data: RentalPDFData }) {
	const { property, tenant, lease, additionalClauses, generatedAt } = data;

	const clauseVars = {
		monthly_rent: fmtMoney(lease.monthly_rent),
		deposit: fmtMoney(lease.deposit),
		currency: lease.currency,
		start_date: formatDate(lease.start_date),
	};
	const resolvedClauses = RENTAL_STANDARD_CLAUSES.map((c) =>
		interpolate(c, clauseVars),
	);

	const heroMeta = [
		property.city,
		property.size_sqm != null ? `${property.size_sqm} m²` : null,
	]
		.filter(Boolean)
		.join("  •  ");

	return (
		<View>
			<DocHeader
				title="Residential Rental Agreement"
				subtitle={`Generated ${formatDate(generatedAt)}`}
			/>

			<HeroAddress address={property.address_line} meta={heroMeta || undefined} />

			{/* Parties */}
			<View style={styles.section}>
				<SectionTitle title="Parties" />
				<CardGrid>
					<Card
						title="Landlord"
						primary={property.homeowner_name}
						lines={["Owner of the property listed above"]}
					/>
					<Card
						title="Tenant"
						primary={tenant.full_name}
						lines={[
							tenant.phone,
							tenant.email,
							tenant.national_id ? `ID: ${tenant.national_id}` : null,
						]}
					/>
				</CardGrid>
			</View>

			{/* Term & Rent */}
			<View style={styles.section} wrap={false}>
				<SectionTitle title="Term & Rent" />
				<HighlightPair
					left={{
						label: "Monthly Rent",
						value: fmtMoney(lease.monthly_rent),
						currency: lease.currency,
					}}
					right={{
						label: "Security Deposit",
						value: fmtMoney(lease.deposit),
						currency: lease.currency,
					}}
				/>
				<View style={{ marginTop: 8 }}>
					<KVList
						items={[
							{ label: "Term", value: termLabel(lease.term) },
							{ label: "Start Date", value: formatDate(lease.start_date) },
							{
								label: "End Date",
								value: lease.end_date ? formatDate(lease.end_date) : "Open-ended",
							},
						]}
					/>
				</View>
			</View>

			<ClausesList label="Standard Clauses" clauses={resolvedClauses} />

			{additionalClauses && additionalClauses.trim() ? (
				<TextSection label="Additional Clauses" text={additionalClauses} />
			) : null}

			<SignatureBlock
				signers={[
					{ role: "Landlord", name: property.homeowner_name },
					{ role: "Tenant", name: tenant.full_name },
				]}
			/>

			<PageFooter />
		</View>
	);
}
