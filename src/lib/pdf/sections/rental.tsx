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
	Callout,
	Table,
	formatDate,
	fmtMoney,
} from "./common";
import { UTILITY_RESP_LABELS, UTILITY_NAMES } from "../rentalClauses";
import { resolveClauseTemplates } from "@/src/lib/documents/clauses";
import { buildRentalClauseVars } from "@/src/lib/documents/clauseVars";
import { interpolate } from "../interpolate";
import type { RentalPDFData } from "../types";

const fmtOrBlank = (s: string | number | null | undefined) =>
	s != null && String(s).trim() ? String(s) : "—";

const termLabel = (t: RentalPDFData["lease"]["term"]) =>
	t === "1yr" ? "1 Yıl" : t === "2yr" ? "2 Yıl" : "Belirsiz süreli";

/** True when the deposit exceeds the TBK m.342 cap of three months' rent. */
export function depositOverCap(deposit: number, monthlyRent: number) {
	return monthlyRent > 0 && deposit > monthlyRent * 3;
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
		inventory,
		condition_notes,
		special_conditions,
		generatedAt,
	} = data;

	const clauseVars = buildRentalClauseVars(data);
	const resolvedClauses = resolveClauseTemplates("rental", data.clauses)
		.map((c) => interpolate(c, clauseVars));

	const overCap = depositOverCap(lease.deposit, lease.monthly_rent);
	const hasInventory = inventory.length > 0;
	const { palette, logoDataUrl } = useBranding();

	return (
		<View>
			{/* Title bar (bleeds beyond page padding via negative margins) */}
			<View style={[styles.docHero, { backgroundColor: palette.primary }]}>
				<Text style={styles.docHeroTitle}>Konut Kira Sözleşmesi</Text>
				<View style={{ alignItems: "flex-end" }}>
					{logoDataUrl ? (
						// eslint-disable-next-line jsx-a11y/alt-text
						<Image src={logoDataUrl} style={{ maxHeight: 24, maxWidth: 100, objectFit: "contain", marginBottom: 3 }} />
					) : null}
					<Text style={[styles.docHeroDate, { color: palette.muted }]}>Düzenleme: {formatDate(generatedAt)}</Text>
				</View>
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
					<Text style={[styles.propAddressLabel, { color: palette.accent }]}>Adres</Text>
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
				<MoneyPair
					left={{ label: "Aylık Kira", value: fmtMoney(lease.monthly_rent), currency: lease.currency }}
					right={{ label: "Depozito", value: fmtMoney(lease.deposit), currency: lease.currency }}
				/>

				{overCap ? (
					<Callout tone="warning">
						Uyarı: Depozito üç aylık kira bedelini aşmaktadır (TBK m.342 — yasal üst sınır aşılmış olabilir).
					</Callout>
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
				<SectionChip title="İlgili Hükümler" />
				<ClausesList label="" clauses={resolvedClauses} />
			</View>

			{/* Signatures */}
			<SignatureBlock
				label="İmzalar"
				date={formatDate(generatedAt)}
				signers={[
					{ role: "Kiraya Veren", name: landlord.full_name },
					{ role: "Kiracı", name: tenant.full_name },
					...(guarantor ? [{ role: "Kefil", name: guarantor.full_name }] : []),
				]}
			/>
		</View>
	);
}
