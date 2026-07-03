// Rent receipt (kira makbuzu) — one page acknowledging a single rent payment.

import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import {
	DocHeader, HeroAddress, SectionTitle, CardGrid, Card, KVList,
	SignatureBlock, PageFooter, formatDate,
} from "./common";

import type { ReceiptPDFData } from "../types";

const fmtMoney = (n: number) =>
	n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function RentReceipt({ data }: { data: ReceiptPDFData }) {
	return (
		<View>
			<DocHeader title="Rent Receipt" subtitle="Kira Makbuzu" />

			<HeroAddress
				address={data.property_address}
				meta={data.city ?? undefined}
			/>

			<CardGrid>
				<Card title="Landlord / Kiraya Veren" primary={data.landlord_name} />
				<Card title="Tenant / Kiracı" primary={data.tenant_name} />
			</CardGrid>

			<View style={styles.section}>
				<SectionTitle title="Payment / Ödeme" />
				<KVList
					items={[
						{ label: "Amount / Tutar", value: `${fmtMoney(data.amount)} ${data.currency}` },
						{ label: "Period / Dönem", value: `${data.period_start} — ${data.period_end}` },
						{ label: "Payment date / Ödeme tarihi", value: data.paid_at ? formatDate(data.paid_at) : formatDate(data.generatedAt) },
						{ label: "Method / Ödeme şekli", value: data.method || "—" },
					]}
				/>
			</View>

			<View style={styles.section}>
				<Text style={styles.bodyText}>
					The landlord acknowledges receipt of the rent amount stated above for the
					property and period indicated. / Kiraya veren, yukarıda belirtilen taşınmaz
					ve dönem için kira bedelini teslim aldığını beyan eder.
				</Text>
			</View>

			<SignatureBlock
				label="Signatures / İmzalar"
				signers={[
					{ role: "Landlord / Kiraya Veren", name: data.landlord_name },
					{ role: "Tenant / Kiracı", name: data.tenant_name },
				]}
			/>

			<PageFooter />
		</View>
	);
}
