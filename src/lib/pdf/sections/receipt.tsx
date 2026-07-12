// Kira makbuzu — one page acknowledging a single rent payment.

import { View, Text } from "@react-pdf/renderer";
import { styles, colors } from "../styles";
import { useBranding } from "../branding";
import {
	DocHeader, HeroAddress, SectionTitle, CardGrid, Card, KVList,
	SignatureBlock, formatDate, fmtMoney,
} from "./common";

import type { ReceiptPDFData } from "../types";

export function RentReceipt({ data }: { data: ReceiptPDFData }) {
	const { palette } = useBranding();
	const paidDate = data.paid_at ? formatDate(data.paid_at) : formatDate(data.generatedAt);

	return (
		<View>
			<DocHeader title="Kira Makbuzu" />

			<HeroAddress
				address={data.property_address}
				meta={data.city ?? undefined}
			/>

			{/* Amount hero — the payment is the point of this document. */}
			<View
				style={[styles.moneyBoxFilled, {
					backgroundColor: palette.primary,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-end",
					marginBottom: 20,
				}]}
				wrap={false}
			>
				<View>
					<Text style={[styles.moneyLabel, { color: palette.muted }]}>Ödenen Tutar</Text>
					<View style={{ flexDirection: "row", alignItems: "baseline" }}>
						<Text style={[styles.moneyValue, { fontSize: 26, color: colors.white }]}>
							{fmtMoney(data.amount)}
						</Text>
						<Text style={[styles.moneyCurrency, { color: palette.muted }]}>{data.currency}</Text>
					</View>
				</View>
				<View style={{ alignItems: "flex-end" }}>
					<Text style={[styles.moneyLabel, { color: palette.muted, marginBottom: 2 }]}>Ödeme Tarihi</Text>
					<Text style={{ fontSize: 10, fontWeight: 700, color: colors.white }}>{paidDate}</Text>
				</View>
			</View>

			<CardGrid>
				<Card title="Kiraya Veren" primary={data.landlord_name} />
				<Card title="Kiracı" primary={data.tenant_name} />
			</CardGrid>

			<View style={[styles.section, { marginTop: 20 }]}>
				<SectionTitle title="Ödeme Bilgileri" />
				<KVList
					items={[
						{ label: "Dönem", value: `${formatDate(data.period_start)} — ${formatDate(data.period_end)}` },
						{ label: "Ödeme tarihi", value: paidDate },
						{ label: "Ödeme şekli", value: data.method || "—" },
					]}
				/>
			</View>

			<View style={styles.section}>
				<Text style={styles.bodyText}>
					Kiraya veren, yukarıda belirtilen taşınmaz ve dönem için kira bedelini
					eksiksiz olarak teslim aldığını beyan eder.
				</Text>
			</View>

			<SignatureBlock
				label="İmzalar"
				date={paidDate}
				signers={[
					{ role: "Kiraya Veren", name: data.landlord_name },
					{ role: "Kiracı", name: data.tenant_name },
				]}
			/>
		</View>
	);
}
