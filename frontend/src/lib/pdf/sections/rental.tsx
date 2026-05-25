import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import {
	DocHeader,
	TextSection,
	TermsList,
	SignatureBlock,
	PageFooter,
	KVRow,
	formatDate,
} from "./common";
import { RENTAL_STANDARD_CLAUSES, interpolate } from "../rentalClauses";
import type { RentalPDFData } from "../types";

const termLabel = (t: RentalPDFData["lease"]["term"]) =>
	t === "1yr" ? "1 year" : t === "2yr" ? "2 years" : "Undefined";

export function RentalAgreement({ data }: { data: RentalPDFData }) {
	const { property, tenant, lease, additionalClauses, generatedAt } = data;

	const clauseVars = {
		monthly_rent: lease.monthly_rent.toFixed(2),
		deposit: lease.deposit.toFixed(2),
		currency: lease.currency,
		start_date: formatDate(lease.start_date),
	};
	const resolvedClauses = RENTAL_STANDARD_CLAUSES.map((c) => interpolate(c, clauseVars));

	return (
		<View>
			<DocHeader
				title="Residential Rental Agreement"
				subtitle={`Generated ${formatDate(generatedAt)}`}
			/>

			{/* Parties */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Parties</Text>
				<View style={styles.twoCol}>
					<View style={styles.col}>
						<KVRow label="Landlord" value={property.homeowner_name} />
					</View>
					<View style={styles.col}>
						<KVRow label="Tenant" value={tenant.full_name} />
						{tenant.email ? <KVRow label="Email" value={tenant.email} /> : null}
						{tenant.phone ? <KVRow label="Phone" value={tenant.phone} /> : null}
						{tenant.national_id ? <KVRow label="National ID" value={tenant.national_id} /> : null}
					</View>
				</View>
			</View>

			{/* Property */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Property</Text>
				<KVRow label="Address" value={property.address_line} />
				<View style={styles.twoCol}>
					<View style={styles.col}>
						<KVRow label="City" value={property.city ?? "—"} />
					</View>
					<View style={styles.col}>
						<KVRow
							label="Size"
							value={property.size_sqm != null ? `${property.size_sqm} m²` : "—"}
						/>
					</View>
				</View>
			</View>

			{/* Term */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Term & Rent</Text>
				<View style={styles.twoCol}>
					<View style={styles.col}>
						<KVRow label="Term" value={termLabel(lease.term)} />
						<KVRow label="Start Date" value={formatDate(lease.start_date)} />
						<KVRow
							label="End Date"
							value={lease.end_date ? formatDate(lease.end_date) : "Undefined"}
						/>
					</View>
					<View style={styles.col}>
						<KVRow
							label="Monthly Rent"
							value={`${lease.monthly_rent.toFixed(2)} ${lease.currency}`}
						/>
						<KVRow
							label="Security Deposit"
							value={`${lease.deposit.toFixed(2)} ${lease.currency}`}
						/>
					</View>
				</View>
			</View>

			<TermsList label="Standard Clauses" terms={resolvedClauses} />

			{additionalClauses && additionalClauses.trim() ? (
				<TextSection label="Additional Clauses" text={additionalClauses} />
			) : null}

			<SignatureBlock signers={["Landlord", "Tenant"]} />

			<PageFooter />
		</View>
	);
}
