import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "../styles";
import { useBranding } from "../branding";
import {
	SectionChip,
	TextSection,
	ClausesList,
	SignatureBlock,
	PartyCard,
	MoneyPair,
	Table,
	formatDate,
	fmtMoney,
} from "./common";
import { resolveClauseTemplates } from "@/src/lib/documents/clauses";
import { buildSalesClauseVars } from "@/src/lib/documents/clauseVars";
import { interpolate } from "../interpolate";
import type { SalesPDFData, CommissionLine } from "../types";

const fmtOrBlank = (s: string | null | undefined) => (s && String(s).trim() ? String(s) : "—");

const commissionCells = (line: CommissionLine): string[] => [
	line.rate == null ? "—" : `%${line.rate.toFixed(2)}`,
	line.matrah == null ? "—" : fmtMoney(line.matrah),
	line.kdv == null ? "—" : fmtMoney(line.kdv),
	line.total == null ? "—" : fmtMoney(line.total),
];

function PropCell({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.propGridCell}>
			<Text style={styles.propGridLabel}>{label}</Text>
			<Text style={styles.propGridValue}>{value}</Text>
		</View>
	);
}

export function SalesAgreement({ data }: { data: SalesPDFData }) {
	const { seller, buyer, property, sale, commission, special_conditions, generatedAt } = data;
	const { palette, teamName, logoDataUrl } = useBranding();

	const clauseVars = buildSalesClauseVars(data, teamName);
	const resolvedClauses = resolveClauseTemplates("sales", data.clauses)
		.map((c) => interpolate(c, clauseVars));

	return (
		<View>
			{/* Title bar (bleeds beyond page padding via negative margins) */}
			<View style={[styles.docHero, { backgroundColor: palette.primary }]}>
				<Text style={styles.docHeroTitle}>Satılık Alım, Satış Sözleşmesi</Text>
				<View style={{ alignItems: "flex-end" }}>
					{logoDataUrl ? (
						// eslint-disable-next-line jsx-a11y/alt-text
						<Image src={logoDataUrl} style={{ maxHeight: 24, maxWidth: 100, objectFit: "contain", marginBottom: 3 }} />
					) : null}
					<Text style={[styles.docHeroDate, { color: palette.muted }]}>Düzenleme: {formatDate(generatedAt)}</Text>
				</View>
			</View>

			{/* A — Mal sahibi */}
			<View style={styles.section}>
				<SectionChip letter="A" title="Mal Sahibi Bilgileri" />
				<PartyCard party={seller} roleLabel="Mal Sahibi" />
			</View>

			{/* B — Alıcı */}
			<View style={styles.section}>
				<SectionChip letter="B" title="Alıcı Bilgileri" />
				<PartyCard party={buyer} roleLabel="Alıcı" />
			</View>

			{/* C — Gayrimenkul */}
			<View style={styles.section}>
				<SectionChip letter="C" title="Gayrimenkule Ait Bilgiler" />
				<View style={styles.propBlock} wrap={false}>
					<Text style={[styles.propAddressLabel, { color: palette.accent }]}>Adres</Text>
					<Text style={styles.propAddressValue}>{property.address || "—"}</Text>

					<View style={styles.propGrid}>
						<PropCell label="Niteliği" value={fmtOrBlank(property.nitelik)} />
						<PropCell label="Yüz Ölçümü" value={property.yuz_olcumu ? `${property.yuz_olcumu} m²` : "—"} />
						<PropCell label="Durum" value={fmtOrBlank(property.durum)} />
						<PropCell label="Mahalle" value={fmtOrBlank(property.mahalle)} />
						<PropCell label="Mevkii" value={fmtOrBlank(property.mevkii)} />
						<PropCell label="Ada No" value={fmtOrBlank(property.ada_no)} />
						<PropCell label="Parsel No" value={fmtOrBlank(property.parsel_no)} />
					</View>
				</View>
			</View>

			{/* D — Özel şartlar (only when set) */}
			{special_conditions && special_conditions.trim() ? (
				<View style={styles.section}>
					<SectionChip letter="D" title="Özel Şartlar" />
					<TextSection label="" text={special_conditions} />
				</View>
			) : null}

			{/* E — Hizmet bedeli (commission) */}
			<View style={styles.section}>
				<SectionChip letter="E" title="Yapılacak İşleme Ait Bilgiler" />
				<Table
					columns={[
						{ header: "Hizmet Bedeli", flex: 1.2, align: "left" },
						{ header: "Oran", flex: 1, align: "right" },
						{ header: "Matrah", flex: 1, align: "right" },
						{ header: "KDV", flex: 1, align: "right" },
						{ header: "Toplam", flex: 1, align: "right" },
					]}
					rows={[
						["Alıcı", ...commissionCells(commission.buyer)],
						["Satıcı", ...commissionCells(commission.seller)],
					]}
				/>
			</View>

			{/* Sale price + kapora highlight pair */}
			<View style={styles.section} wrap={false}>
				<MoneyPair
					left={{ label: "Satış Bedeli", value: fmtMoney(sale.sale_price), currency: sale.currency }}
					right={{
						label: "Kapora",
						value: sale.deposit_amount != null ? fmtMoney(sale.deposit_amount) : "—",
						currency: sale.currency,
					}}
				/>

				<Text style={styles.connectiveLine}>
					Bundan böyle, {teamName.toLocaleUpperCase("tr")} yetkilendiren MAL SAHİBİ olarak anılacaktır.
				</Text>
			</View>

			{/* Numbered clauses */}
			<View>
				<SectionChip title="İlgili Hükümler" />
				<ClausesList label="" clauses={resolvedClauses} />
			</View>

			{/* Signatures */}
			<SignatureBlock
				label="İmzalar"
				date={formatDate(generatedAt)}
				signers={[
					{ role: "Mal Sahibi", name: seller.full_name },
					{ role: "Alıcı",      name: buyer.full_name },
					{ role: teamName },
				]}
			/>
		</View>
	);
}
