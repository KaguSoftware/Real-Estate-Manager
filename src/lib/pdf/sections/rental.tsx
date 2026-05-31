import { View, Text } from "@react-pdf/renderer";
import { styles, colors } from "../styles";
import {
	TextSection,
	ClausesList,
	SignatureBlock,
	PageFooter,
	Table,
	formatDate,
} from "./common";
import {
	RENTAL_STANDARD_CLAUSES,
	RENTAL_NOTICE_DAYS,
	SUBLETTING_CLAUSES,
	RENT_INCREASE_DEFAULT_CLAUSE,
	UTILITY_RESP_LABELS,
	UTILITY_NAMES,
} from "../rentalClauses";
import { interpolate } from "../interpolate";
import type { RentalPDFData, PartyInfo } from "../types";

const fmtMoney = (n: number | null | undefined) =>
	(n == null ? 0 : n).toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmtOrBlank = (s: string | number | null | undefined) =>
	s != null && String(s).trim() ? String(s) : "—";

const termLabel = (t: RentalPDFData["lease"]["term"]) =>
	t === "1yr" ? "1 Yıl" : t === "2yr" ? "2 Yıl" : "Belirsiz süreli";

/** True when the deposit exceeds the TBK m.342 cap of three months' rent. */
export function depositOverCap(deposit: number, monthlyRent: number) {
	return monthlyRent > 0 && deposit > monthlyRent * 3;
}

function SectionChip({ letter, title }: { letter: string; title: string }) {
	return (
		<View style={styles.salesSectionChip}>
			<Text style={styles.salesSectionChipText}>
				{letter ? `${letter}  ·  ${title}` : title}
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

function PartyCard({ party, roleLabel }: { party: PartyInfo; roleLabel: string }) {
	return (
		// wrap={false} keeps the bordered card from splitting across a page break.
		<View style={styles.salesCard} wrap={false}>
			<CardLabelValue label={`${roleLabel} — Adı Soyadı / Firma`} value={party.full_name || "—"} />

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

function PropCell({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.propGridCell}>
			<Text style={styles.propGridLabel}>{label}</Text>
			<Text style={styles.propGridValue}>{value}</Text>
		</View>
	);
}

const UTILITY_KEYS = ["electricity", "water", "gas", "internet", "aidat"] as const;

export function RentalAgreement({ data }: { data: RentalPDFData }) {
	const {
		landlord,
		tenant,
		guarantor,
		property,
		lease,
		utilities,
		subletting_allowed,
		rent_increase_note,
		inventory,
		condition_notes,
		special_conditions,
		generatedAt,
	} = data;

	const utilitiesSummary = (Object.keys(UTILITY_NAMES) as (keyof typeof UTILITY_NAMES)[])
		.map((k) => `${UTILITY_NAMES[k]}: ${UTILITY_RESP_LABELS[utilities[k]]}`)
		.join("; ") + ".";

	const clauseVars = {
		monthly_rent: fmtMoney(lease.monthly_rent),
		deposit: fmtMoney(lease.deposit),
		currency: lease.currency,
		start_date: formatDate(lease.start_date),
		payment_day: lease.payment_day ?? 1,
		notice_days: RENTAL_NOTICE_DAYS,
		utilities_summary: utilitiesSummary,
		subletting_clause: SUBLETTING_CLAUSES[subletting_allowed ? "true" : "false"],
		rent_increase_clause:
			rent_increase_note && rent_increase_note.trim()
				? rent_increase_note.trim()
				: RENT_INCREASE_DEFAULT_CLAUSE,
	};
	const resolvedClauses = RENTAL_STANDARD_CLAUSES.map((c) => interpolate(c, clauseVars));

	const overCap = depositOverCap(lease.deposit, lease.monthly_rent);
	const hasInventory = inventory.length > 0;

	return (
		<View>
			{/* Title bar (bleeds beyond page padding via negative margins) */}
			<View style={styles.salesHero}>
				<Text style={styles.salesHeroTitle}>Konut Kira Sözleşmesi</Text>
				<Text style={styles.salesHeroDate}>Düzenleme: {formatDate(generatedAt)}</Text>
			</View>

			{/* A — Kiraya Veren */}
			<View style={styles.section}>
				<SectionChip letter="A" title="Kiraya Veren Bilgileri" />
				<PartyCard party={landlord} roleLabel="Kiraya Veren" />
			</View>

			{/* B — Kiracı */}
			<View style={styles.section}>
				<SectionChip letter="B" title="Kiracı Bilgileri" />
				<PartyCard party={tenant} roleLabel="Kiracı" />
			</View>

			{/* C — Kefil (optional) */}
			{guarantor ? (
				<View style={styles.section}>
					<SectionChip letter="C" title="Kefil Bilgileri" />
					<PartyCard party={guarantor} roleLabel="Kefil" />
				</View>
			) : null}

			{/* D — Taşınmaz */}
			<View style={styles.section}>
				<SectionChip letter="D" title="Taşınmaza Ait Bilgiler" />
				<View style={styles.propBlock} wrap={false}>
					<Text style={styles.propAddressLabel}>Adresi</Text>
					<Text style={styles.propAddressValue}>{property.address || "—"}</Text>

					<View style={styles.propGrid}>
						<PropCell label="Niteliği" value={fmtOrBlank(property.nitelik)} />
						<PropCell label="Yüz Ölçümü" value={property.size_sqm != null ? `${property.size_sqm} m²` : "—"} />
						<PropCell label="Kat" value={fmtOrBlank(property.floor)} />
						<PropCell label="Daire No" value={fmtOrBlank(property.unit_no)} />
						<PropCell label="Şehir" value={fmtOrBlank(property.city)} />
					</View>
				</View>
			</View>

			{/* E — Kira & Süre */}
			<View style={styles.section}>
				<SectionChip letter="E" title="Kira ve Süre" />
				<View style={{ flexDirection: "row", gap: 12 }} wrap={false}>
					<View style={styles.salesPriceBox}>
						<Text style={styles.salesPriceLabel}>Aylık Kira</Text>
						<View style={{ flexDirection: "row", alignItems: "baseline" }}>
							<Text style={styles.salesPriceValue}>{fmtMoney(lease.monthly_rent)}</Text>
							<Text style={[styles.salesCurrencyTag, { color: colors.gray_brand }]}>{lease.currency}</Text>
						</View>
					</View>
					<View style={styles.salesDepositBox}>
						<Text style={styles.salesDepositLabel}>Depozito</Text>
						<View style={{ flexDirection: "row", alignItems: "baseline" }}>
							<Text style={styles.salesDepositValue}>{fmtMoney(lease.deposit)}</Text>
							<Text style={[styles.salesCurrencyTag, { color: colors.red_brand }]}>{lease.currency}</Text>
						</View>
					</View>
				</View>

				{overCap ? (
					<Text style={[styles.avaraLine, { color: colors.red_brand }]}>
						Uyarı: Depozito üç aylık kira bedelini aşmaktadır (TBK m.342 — yasal üst sınır aşılmış olabilir).
					</Text>
				) : null}

				<View style={{ marginTop: 8 }}>
					<View style={styles.kvRow}>
						<Text style={styles.kvLabel}>Süre</Text>
						<Text style={styles.kvValue}>{termLabel(lease.term)}</Text>
					</View>
					<View style={styles.kvRow}>
						<Text style={styles.kvLabel}>Başlangıç</Text>
						<Text style={styles.kvValue}>{formatDate(lease.start_date)}</Text>
					</View>
					<View style={styles.kvRow}>
						<Text style={styles.kvLabel}>Bitiş</Text>
						<Text style={styles.kvValue}>{lease.end_date ? formatDate(lease.end_date) : "Belirsiz süreli"}</Text>
					</View>
					<View style={styles.kvRow}>
						<Text style={styles.kvLabel}>Ödeme Günü</Text>
						<Text style={styles.kvValue}>{lease.payment_day != null ? `Her ayın ${lease.payment_day}. günü` : "—"}</Text>
					</View>
					<View style={styles.kvRow}>
						<Text style={styles.kvLabel}>Ödeme Şekli</Text>
						<Text style={styles.kvValue}>{fmtOrBlank(lease.payment_method)}</Text>
					</View>
					<View style={styles.kvRowLast}>
						<Text style={styles.kvLabel}>IBAN / Hesap</Text>
						<Text style={styles.kvValue}>{fmtOrBlank(lease.bank_account)}</Text>
					</View>
				</View>
			</View>

			{/* F — Abonelikler */}
			<View style={styles.section}>
				<SectionChip letter="F" title="Abonelik Sorumlulukları" />
				<Table
					columns={[
						{ header: "Abonelik", flex: 1.4, align: "left" },
						{ header: "Sorumlu", flex: 1, align: "left" },
					]}
					rows={UTILITY_KEYS.map((k) => [UTILITY_NAMES[k], UTILITY_RESP_LABELS[utilities[k]]])}
				/>
			</View>

			{/* G — Demirbaş (only when set) */}
			{hasInventory ? (
				<View style={styles.section}>
					<SectionChip letter="G" title="Demirbaş Listesi" />
					<Table
						columns={[
							{ header: "Demirbaş", flex: 2.2, align: "left" },
							{ header: "Adet", flex: 0.8, align: "center" },
							{ header: "Not", flex: 2.5, align: "left" },
						]}
						rows={inventory.map((it) => [
							fmtOrBlank(it.item),
							it.qty == null ? "—" : String(it.qty),
							fmtOrBlank(it.note),
						])}
					/>
				</View>
			) : null}

			{/* H — Taşınmazın durumu (only when set) */}
			{condition_notes && condition_notes.trim() ? (
				<View style={styles.section}>
					<SectionChip letter="H" title="Taşınmazın Durumu" />
					<TextSection label="" text={condition_notes} />
				</View>
			) : null}

			{/* I — Özel şartlar (only when set) */}
			{special_conditions && special_conditions.trim() ? (
				<View style={styles.section}>
					<SectionChip letter="I" title="Özel Şartlar" />
					<TextSection label="" text={special_conditions} />
				</View>
			) : null}

			{/* Numbered clauses */}
			<View>
				<SectionChip letter="" title="İlgili Hükümler" />
				<ClausesList label="" clauses={resolvedClauses} />
			</View>

			{/* Signatures */}
			<SignatureBlock
				label="İmzalar"
				accentColor={colors.navy_brand}
				signers={[
					{ role: "Kiraya Veren", name: landlord.full_name },
					{ role: "Kiracı", name: tenant.full_name },
					...(guarantor ? [{ role: "Kefil", name: guarantor.full_name }] : []),
				]}
			/>

			<PageFooter />
		</View>
	);
}
