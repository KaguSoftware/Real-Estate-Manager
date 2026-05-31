import { View, Text } from "@react-pdf/renderer";
import { styles, colors } from "../styles";
import {
	TextSection,
	ClausesList,
	SignatureBlock,
	PageFooter,
	formatDate,
} from "./common";
import { SALES_STANDARD_CLAUSES, TAX_RESPONSIBILITY_CLAUSES } from "../salesClauses";
import { interpolate } from "../interpolate";
import type { SalesPDFData, PartyInfo, CommissionLine } from "../types";

const fmtMoney = (n: number | null | undefined) =>
	(n == null ? 0 : n).toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmtDateOrBlank = (s: string | null | undefined) =>
	s ? formatDate(s) : "...";

const fmtOrBlank = (s: string | null | undefined) => (s && String(s).trim() ? String(s) : "—");

function SectionChip({ letter, title }: { letter: string; title: string }) {
	return (
		<View style={styles.salesSectionChip}>
			<Text style={styles.salesSectionChipText}>
				{letter}  ·  {title}
			</Text>
		</View>
	);
}

/**
 * One field row inside a PartyCard. Each field is wrapped in a `<View>` with a
 * `minHeight` floor (mirroring propGridCell) rather than being a bare `<Text>`.
 * The real cause of the old "card collapses, fields overlap" bug was a react-pdf
 * lineHeight-compounding issue, now fixed by removing all `lineHeight` from
 * styles.ts (see the note on `styles.page`). These View floors are kept as
 * defense-in-depth: View `minHeight` is unaffected by text relayout, so a row
 * can never collapse to zero height even if react-pdf regresses.
 */
function CardLabelValue({ label, value }: { label: string; value: string }) {
	return (
		<>
			<View style={styles.salesCardFieldLabel}>
				<Text style={styles.salesCardLabel}>{label}</Text>
			</View>
			<View style={styles.salesCardFieldValue}>
				<Text style={styles.salesCardValue}>{value}</Text>
			</View>
		</>
	);
}

function CardLine({ children }: { children: string }) {
	return (
		<View style={styles.salesCardFieldLine}>
			<Text style={styles.salesCardLine}>{children}</Text>
		</View>
	);
}

function PartyCard({ party }: { party: PartyInfo }) {
	return (
		// wrap={false} keeps the bordered card from splitting across a page break.
		<View style={styles.salesCard} wrap={false}>
			<CardLabelValue label="Adı Soyadı / Firma" value={party.full_name || "—"} />

			<View style={styles.salesCardFieldLabel}>
				<Text style={styles.salesCardLabel}>Adresi</Text>
			</View>
			<CardLine>{party.address || "—"}</CardLine>

			{(party.national_id || party.tax_no || party.tax_office) ? (
				<>
					<View style={styles.salesCardGroupGap} />
					{party.national_id ? <CardLine>{`T.C. Kimlik: ${party.national_id}`}</CardLine> : null}
					{party.tax_no ? <CardLine>{`Vergi No: ${party.tax_no}`}</CardLine> : null}
					{party.tax_office ? <CardLine>{`V. Dairesi: ${party.tax_office}`}</CardLine> : null}
				</>
			) : null}

			{(party.phone || party.email) ? (
				<>
					<View style={styles.salesCardGroupGap} />
					{party.phone ? <CardLine>{`Tel: ${party.phone}`}</CardLine> : null}
					{party.email ? <CardLine>{`E-posta: ${party.email}`}</CardLine> : null}
				</>
			) : null}
		</View>
	);
}

function CommissionRow({
	label,
	line,
	alt,
}: {
	label: string;
	line: CommissionLine;
	alt?: boolean;
}) {
	return (
		<View style={alt ? styles.commissionRowAlt : styles.commissionRow} wrap={false}>
			<Text style={styles.commissionLabelCell}>{label}</Text>
			<Text style={styles.commissionDataCell}>
				{line.rate == null ? "—" : `${line.rate.toFixed(2)} %`}
			</Text>
			<Text style={styles.commissionDataCell}>
				{line.matrah == null ? "—" : fmtMoney(line.matrah)}
			</Text>
			<Text style={styles.commissionDataCell}>
				{line.kdv == null ? "—" : fmtMoney(line.kdv)}
			</Text>
			<Text style={[styles.commissionDataCell, { borderRightWidth: 0, fontWeight: "bold" }]}>
				{line.total == null ? "—" : fmtMoney(line.total)}
			</Text>
		</View>
	);
}

export function SalesAgreement({ data }: { data: SalesPDFData }) {
	const { seller, buyer, property, sale, commission, special_conditions, generatedAt } = data;

	const clauseVars = {
		sale_price: fmtMoney(sale.sale_price),
		currency: sale.currency,
		penalty_amount: sale.penalty_amount != null ? fmtMoney(sale.penalty_amount) : "...",
		deposit_amount: sale.deposit_amount != null ? fmtMoney(sale.deposit_amount) : "...",
		target_close_date: fmtDateOrBlank(sale.target_close_date),
		validity_days: sale.validity_days ?? "...",
		tax_responsibility_clause: TAX_RESPONSIBILITY_CLAUSES[sale.tax_responsibility],
	};
	const resolvedClauses = SALES_STANDARD_CLAUSES.map((c) => interpolate(c, clauseVars));

	return (
		<View>
			{/* Title bar (bleeds beyond page padding via negative margins) */}
			<View style={styles.salesHero} fixed={false}>
				<Text style={styles.salesHeroTitle}>Satılık Alım, Satış Sözleşmesi</Text>
				<Text style={styles.salesHeroDate}>Düzenleme: {formatDate(generatedAt)}</Text>
			</View>

			{/* A — Mal sahibi */}
			<View style={styles.section}>
				<SectionChip letter="A" title="Mal Sahibi Bilgileri" />
				<PartyCard party={seller} />
			</View>

			{/* B — Alıcı */}
			<View style={styles.section}>
				<SectionChip letter="B" title="Alıcı Bilgileri" />
				<PartyCard party={buyer} />
			</View>

			{/* C — Gayrimenkul */}
			<View style={styles.section}>
				<SectionChip letter="C" title="Gayrimenkule Ait Bilgiler" />
				<View style={styles.propBlock} wrap={false}>
					<Text style={styles.propAddressLabel}>Adresi</Text>
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
				<View style={styles.commissionTable}>
					<View style={styles.commissionHeaderRow} wrap={false}>
						<Text style={styles.commissionHeaderCellLeft}>Hizmet Bedeli</Text>
						<Text style={styles.commissionHeaderCell}>Oran %</Text>
						<Text style={styles.commissionHeaderCell}>Matrah</Text>
						<Text style={styles.commissionHeaderCell}>KDV (%18)</Text>
						<Text style={[styles.commissionHeaderCell, { borderRightWidth: 0 }]}>Toplam Tutar</Text>
					</View>
					<CommissionRow label="Alıcı" line={commission.buyer} />
					<CommissionRow label="Satıcı" line={commission.seller} alt />
				</View>
			</View>

			{/* Sale price + kapora highlight pair */}
			<View style={styles.section} wrap={false}>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<View style={styles.salesPriceBox}>
						<Text style={styles.salesPriceLabel}>Satış Bedeli</Text>
						<View style={{ flexDirection: "row", alignItems: "baseline" }}>
							<Text style={styles.salesPriceValue}>{fmtMoney(sale.sale_price)}</Text>
							<Text style={[styles.salesCurrencyTag, { color: colors.gray_brand }]}>{sale.currency}</Text>
						</View>
					</View>
					<View style={styles.salesDepositBox}>
						<Text style={styles.salesDepositLabel}>Kapora</Text>
						<View style={{ flexDirection: "row", alignItems: "baseline" }}>
							<Text style={styles.salesDepositValue}>
								{sale.deposit_amount != null ? fmtMoney(sale.deposit_amount) : "—"}
							</Text>
							<Text style={[styles.salesCurrencyTag, { color: colors.red_brand }]}>{sale.currency}</Text>
						</View>
					</View>
				</View>

				<Text style={styles.avaraLine}>
					Bundan böyle, AVERA GAYRİMENKUL yetkilendiren MAL SAHİBİ olarak anılacaktır.
				</Text>
			</View>

			{/* Numbered clauses */}
			<View>
				<SectionChip letter="" title="İlgili Hükümler" />
				<ClausesList label="" clauses={resolvedClauses} />
			</View>

			{/* Signatures with navy accent bars matching the reference */}
			<SignatureBlock
				label="İmzalar"
				accentColor={colors.navy_brand}
				signers={[
					{ role: "Mal Sahibi", name: seller.full_name },
					{ role: "Alıcı",      name: buyer.full_name },
					{ role: "AVERA Gayrimenkul" },
				]}
			/>

			<PageFooter />
		</View>
	);
}

function PropCell({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.propGridCell}>
			<Text style={styles.propGridLabel}>{label}</Text>
			<Text style={styles.propGridValue}>{value}</Text>
		</View>
	);
}
