// Small primitive components shared across PDF templates.
//
// These are the single design system for generated documents: the static
// templates (receipt, listing) and the editor-document mapper both render
// through the same primitives, so the editor and the classic pipeline stay
// visually identical.

import { View, Text, Image } from "@react-pdf/renderer";
import { styles, colors } from "../styles";
import { useBranding } from "../branding";
import type { PartyInfo } from "../types";

/** Turkish long-form date, e.g. "12 Temmuz 2026". */
export const formatDate = (iso?: string) => {
	const d = iso ? new Date(iso) : new Date();
	return d.toLocaleDateString("tr-TR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

/** Turkish money formatting: 1.250.000,50 */
export const fmtMoney = (n: number | null | undefined) =>
	(n == null ? 0 : n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export const DocHeader = ({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) => {
	const { logoDataUrl, palette } = useBranding();
	return (
		<View>
			<View style={styles.headerRow}>
				<View>
					<Text style={[styles.docType, { color: palette.primary }]}>{title}</Text>
					{subtitle ? <Text style={styles.refLine}>{subtitle}</Text> : null}
				</View>
				<View style={{ alignItems: "flex-end" }}>
					{logoDataUrl ? (
						// eslint-disable-next-line jsx-a11y/alt-text
						<Image src={logoDataUrl} style={{ maxHeight: 28, maxWidth: 110, objectFit: "contain", marginBottom: 4 }} />
					) : null}
					<Text style={styles.refLine}>{formatDate()}</Text>
				</View>
			</View>
			<View style={[styles.dividerThin, { backgroundColor: palette.primary }]} />
		</View>
	);
};

/** Section label: small accent square + tracked title (A, B, C… blocks). */
export const SectionChip = ({ letter, title }: { letter?: string; title: string }) => {
	const { palette } = useBranding();
	return (
		<View style={styles.chipRow} minPresenceAhead={40}>
			<View style={[styles.chipSquare, { backgroundColor: palette.accent }]} />
			<Text style={[styles.chipText, { color: palette.primary }]}>
				{letter ? `${letter}  ·  ${title}` : title}
			</Text>
		</View>
	);
};

/** Hero block at the top of the document with the property address. */
export const HeroAddress = ({
	address,
	meta,
}: {
	address: string;
	meta?: string;
}) => {
	const { palette } = useBranding();
	return (
		<View style={[styles.hero, { backgroundColor: palette.tint }]}>
			<Text style={[styles.heroLabel, { color: palette.accent }]}>Taşınmaz</Text>
			<Text style={[styles.heroAddress, { color: palette.primary }]}>{address}</Text>
			{meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
		</View>
	);
};

/**
 * Section title with a horizontal rule on the right.
 * `minPresenceAhead` keeps the heading from stranding alone at the bottom of a
 * page — react-pdf pushes it to the next page unless ~that many points of
 * content can follow it.
 */
export const SectionTitle = ({ title }: { title: string }) => (
	<View style={styles.sectionHeader} minPresenceAhead={40}>
		<Text style={styles.sectionTitle}>{title}</Text>
		<View style={styles.sectionRule} />
	</View>
);

export const TextSection = ({ label, text }: { label: string; text: string }) => (
	<View style={styles.section}>
		{label ? <SectionTitle title={label} /> : null}
		<Text style={styles.bodyText}>{text}</Text>
	</View>
);

/**
 * A two-column row of info cards.
 * Pass any number of cards; they share the row equally via flex:1.
 */
export const CardGrid = ({ children }: { children: React.ReactNode }) => (
	<View style={styles.cardGrid}>{children}</View>
);

export const Card = ({
	title,
	primary,
	lines,
}: {
	title: string;
	primary?: string;
	lines?: (string | null | undefined)[];
}) => (
	<View style={styles.card}>
		<Text style={styles.cardTitle}>{title}</Text>
		{primary ? <Text style={styles.cardPrimary}>{primary}</Text> : null}
		{(lines ?? [])
			.filter((l): l is string => !!l && l.trim().length > 0)
			.map((line, i) => (
				<Text key={i} style={styles.cardLine}>{line}</Text>
			))}
	</View>
);

/** Inline label/value list — used for term and lease facts. */
export const KVList = ({
	items,
}: {
	items: { label: string; value: string }[];
}) => (
	<View>
		{items.map((it, i) => (
			<View key={i} style={i === items.length - 1 ? styles.kvRowLast : styles.kvRow}>
				<Text style={styles.kvLabel}>{it.label}</Text>
				<Text style={styles.kvValue}>{it.value}</Text>
			</View>
		))}
	</View>
);

/** Two side-by-side highlight boxes — listing price + size. */
export const HighlightPair = ({
	left,
	right,
}: {
	left: { label: string; value: string; currency: string };
	right: { label: string; value: string; currency: string };
}) => {
	const { palette } = useBranding();
	const box = [styles.highlightBox, { backgroundColor: palette.tint }];
	const label = [styles.highlightLabel, { color: palette.accent }];
	const value = [styles.highlightValue, { color: palette.primary }];
	return (
		<View style={styles.highlightRow}>
			<View style={box}>
				<Text style={label}>{left.label}</Text>
				<View style={{ flexDirection: "row", alignItems: "baseline" }}>
					<Text style={value}>{left.value}</Text>
					<Text style={styles.highlightCurrency}>{left.currency}</Text>
				</View>
			</View>
			<View style={box}>
				<Text style={label}>{right.label}</Text>
				<View style={{ flexDirection: "row", alignItems: "baseline" }}>
					<Text style={value}>{right.value}</Text>
					<Text style={styles.highlightCurrency}>{right.currency}</Text>
				</View>
			</View>
		</View>
	);
};

/**
 * Filled + outlined money pair — rent/deposit on rentals, price/kapora on
 * sales. The filled box carries the primary brand color; the outlined box
 * carries the accent.
 */
export const MoneyPair = ({
	left,
	right,
}: {
	left: { label: string; value: string; currency: string };
	right: { label: string; value: string; currency: string };
}) => {
	const { palette } = useBranding();
	return (
		<View style={{ flexDirection: "row", gap: 12 }} wrap={false}>
			<View style={[styles.moneyBoxFilled, { backgroundColor: palette.primary }]}>
				<Text style={[styles.moneyLabel, { color: palette.muted }]}>{left.label}</Text>
				<View style={{ flexDirection: "row", alignItems: "baseline" }}>
					<Text style={[styles.moneyValue, { color: colors.white }]}>{left.value}</Text>
					<Text style={[styles.moneyCurrency, { color: palette.muted }]}>{left.currency}</Text>
				</View>
			</View>
			<View style={[styles.moneyBoxOutlined, { borderColor: palette.accent }]}>
				<Text style={[styles.moneyLabel, { color: palette.accent }]}>{right.label}</Text>
				<View style={{ flexDirection: "row", alignItems: "baseline" }}>
					<Text style={[styles.moneyValue, { color: palette.primary }]}>{right.value}</Text>
					<Text style={[styles.moneyCurrency, { color: palette.accent }]}>{right.currency}</Text>
				</View>
			</View>
		</View>
	);
};

/** Tinted note / warning box. Warnings use a fixed semantic red family so
 *  they read as warnings under every brand palette. */
export const Callout = ({
	tone = "note",
	children,
}: {
	tone?: "note" | "warning";
	children: string;
}) => {
	const { palette } = useBranding();
	const bg = tone === "warning" ? "#fdf2f2" : palette.tint;
	const fg = tone === "warning" ? "#b91c1c" : palette.primary;
	return (
		<View style={[styles.callout, { backgroundColor: bg }]} wrap={false}>
			<Text style={[styles.calloutText, { color: fg }]}>{children}</Text>
		</View>
	);
};

/**
 * Party details card. Full hairline border — role identity is carried by a
 * tinted initial square and the small role label, not by a colored border.
 * `wrap={false}` keeps the bordered card from splitting across a page break.
 */
export const PartyCard = ({ party, roleLabel }: { party: PartyInfo; roleLabel: string }) => {
	const { palette } = useBranding();
	const initial = (party.full_name || roleLabel).trim().charAt(0).toLocaleUpperCase("tr");
	const fields: { label: string; value: string }[] = [
		{ label: "Adres", value: party.address || "—" },
	];
	if (party.national_id) fields.push({ label: "T.C. Kimlik", value: party.national_id });
	if (party.tax_no) fields.push({ label: "Vergi No", value: party.tax_no });
	if (party.tax_office) fields.push({ label: "Vergi Dairesi", value: party.tax_office });
	if (party.phone) fields.push({ label: "Telefon", value: party.phone });
	if (party.email) fields.push({ label: "E-posta", value: party.email });

	return (
		<View style={styles.partyCard} wrap={false}>
			<View style={styles.partyCardHeader}>
				<View style={[styles.partyInitial, { backgroundColor: palette.tint }]}>
					<Text style={[styles.partyInitialText, { color: palette.primary }]}>{initial}</Text>
				</View>
				<View style={{ flex: 1 }}>
					<Text style={[styles.partyRole, { color: palette.accent }]}>{roleLabel}</Text>
					<Text style={styles.partyName}>{party.full_name || "—"}</Text>
				</View>
			</View>
			{fields.map((f, i) => (
				<View key={i} style={styles.partyFieldRow}>
					<Text style={styles.partyFieldLabel}>{f.label}</Text>
					<Text style={styles.partyFieldValue}>{f.value}</Text>
				</View>
			))}
		</View>
	);
};

/**
 * Bordered key/value card with an optional title line — the editor-document
 * counterpart of the property block. `wrap={false}` keeps it intact across
 * page breaks.
 */
export const KVCard = ({
	title,
	items,
}: {
	title?: string | null;
	items: { label: string; value: string }[];
}) => {
	const { palette } = useBranding();
	return (
		<View style={styles.propBlock} wrap={false}>
			{title ? (
				<>
					<Text style={[styles.propAddressLabel, { color: palette.accent }]}>Adres</Text>
					<Text style={styles.propAddressValue}>{title}</Text>
				</>
			) : null}
			<View>
				{items.map((it, i) => (
					<View key={i} style={i === items.length - 1 ? styles.kvRowLast : styles.kvRow}>
						<Text style={styles.kvLabel}>{it.label}</Text>
						<Text style={styles.kvValue}>{it.value}</Text>
					</View>
				))}
			</View>
		</View>
	);
};

/** Hairline-separated numbered clause list; numbers carry the accent color. */
export const ClausesList = ({
	label,
	clauses,
}: {
	label: string;
	clauses: string[];
}) => {
	const { palette } = useBranding();
	const filtered = clauses.filter((c) => c && c.trim());
	if (filtered.length === 0) return <View />;
	return (
		<View style={styles.section}>
			{label ? <SectionTitle title={label} /> : null}
			<View>
				{filtered.map((clause, idx) => (
					<View
						key={idx}
						style={idx === filtered.length - 1 ? styles.clauseRowLast : styles.clauseRow}
						wrap={false}
					>
						<Text style={[styles.clauseNumber, { color: palette.accent }]}>
							{String(idx + 1).padStart(2, "0")}
						</Text>
						<Text style={styles.clauseText}>{clause}</Text>
					</View>
				))}
			</View>
		</View>
	);
};

/**
 * Generic bordered table. The container wraps across pages while each row
 * stays intact (`wrap={false}`), so a single row never splits over a page
 * break — mirrors the ClausesList model.
 *
 * `columns[].flex` controls width; `align` controls cell text alignment. Pass
 * the same column shape to the header and every row so they line up.
 */
export interface TableColumn {
	header: string;
	flex?: number;
	align?: "left" | "center" | "right";
}

export const Table = ({
	columns,
	rows,
}: {
	columns: TableColumn[];
	/** Each row is an array of cell strings, one per column. */
	rows: string[][];
}) => {
	const { palette } = useBranding();
	return (
		<View style={styles.table}>
			<View style={[styles.tableHeaderRow, { backgroundColor: palette.primary }]} wrap={false}>
				{columns.map((c, i) => (
					<Text
						key={i}
						style={[styles.tableHeaderCell, { flex: c.flex ?? 1, textAlign: c.align ?? "left" }]}
					>
						{c.header}
					</Text>
				))}
			</View>
			{rows.map((cells, r) => (
				<View
					key={r}
					style={[styles.tableRow, r % 2 === 1 ? { backgroundColor: palette.tint } : {}]}
					wrap={false}
				>
					{cells.map((cell, i) => {
						const col = columns[i];
						const isLabel = i === 0;
						return (
							<Text
								key={i}
								style={[
									isLabel ? styles.tableLabelCell : styles.tableDataCell,
									isLabel ? { color: palette.primary } : {},
									{ flex: col?.flex ?? 1, textAlign: col?.align ?? (isLabel ? "left" : "right") },
								]}
							>
								{cell}
							</Text>
						);
					})}
				</View>
			))}
		</View>
	);
};

export const SignatureBlock = ({
	label = "İmzalar",
	signers,
	date,
}: {
	label?: string;
	signers: { role: string; name?: string }[];
	/** Optional signing-date line rendered under the section title. */
	date?: string;
}) => {
	const { palette } = useBranding();
	return (
		<View style={styles.section} wrap={false}>
			<SectionTitle title={label} />
			{date ? <Text style={styles.signatureSubLabel}>Tarih: {date}</Text> : null}
			<View style={styles.signatureRow}>
				{signers.map((s, i) => (
					<View key={i} style={styles.signatureBox}>
						<View style={[styles.signatureLine, { borderBottomColor: palette.primary }]} />
						<Text style={styles.signatureLabel}>{s.role}</Text>
						{s.name ? <Text style={styles.signatureSubLabel}>{s.name}</Text> : null}
						<Text style={styles.signatureHint}>Ad Soyad / İmza</Text>
					</View>
				))}
			</View>
		</View>
	);
};

export const PageFooter = () => {
	const { teamName } = useBranding();
	return (
		<View style={styles.footer} fixed>
			<Text style={styles.footerText}>{teamName}</Text>
			<Text
				style={styles.pageNumber}
				render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`}
			/>
		</View>
	);
};

export { colors };
