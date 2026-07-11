// Small primitive components shared across PDF templates.

import { View, Text, Image } from "@react-pdf/renderer";
import { styles, colors } from "../styles";
import { useBranding } from "../branding";

export const formatDate = (iso?: string) => {
	const d = iso ? new Date(iso) : new Date();
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export const DocHeader = ({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) => {
	const { logoDataUrl } = useBranding();
	return (
		<View>
			<View style={styles.headerRow}>
				<View>
					<Text style={styles.docType}>{title}</Text>
					{subtitle ? <Text style={styles.refLine}>{subtitle}</Text> : null}
				</View>
				<View style={{ alignItems: "flex-end" }}>
					{logoDataUrl ? (
						<Image src={logoDataUrl} style={{ maxHeight: 28, maxWidth: 110, objectFit: "contain", marginBottom: 4 }} />
					) : null}
					<Text style={styles.refLine}>{formatDate()}</Text>
				</View>
			</View>
			<View style={styles.dividerThin} />
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
}) => (
	<View style={styles.hero}>
		<Text style={styles.heroLabel}>Property</Text>
		<Text style={styles.heroAddress}>{address}</Text>
		{meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
	</View>
);

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
		<SectionTitle title={label} />
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

/** Two side-by-side highlight boxes — used for monthly rent + deposit. */
export const HighlightPair = ({
	left,
	right,
}: {
	left: { label: string; value: string; currency: string };
	right: { label: string; value: string; currency: string };
}) => (
	<View style={styles.highlightRow}>
		<View style={styles.highlightBox}>
			<Text style={styles.highlightLabel}>{left.label}</Text>
			<View style={{ flexDirection: "row", alignItems: "baseline" }}>
				<Text style={styles.highlightValue}>{left.value}</Text>
				<Text style={styles.highlightCurrency}>{left.currency}</Text>
			</View>
		</View>
		<View style={styles.highlightBox}>
			<Text style={styles.highlightLabel}>{right.label}</Text>
			<View style={{ flexDirection: "row", alignItems: "baseline" }}>
				<Text style={styles.highlightValue}>{right.value}</Text>
				<Text style={styles.highlightCurrency}>{right.currency}</Text>
			</View>
		</View>
	</View>
);

/** Banded clauses list with proper page-break behavior. */
export const ClausesList = ({
	label,
	clauses,
}: {
	label: string;
	clauses: string[];
}) => {
	const filtered = clauses.filter((c) => c && c.trim());
	if (filtered.length === 0) return <View />;
	return (
		<View style={styles.section}>
			<SectionTitle title={label} />
			<View>
				{filtered.map((clause, idx) => (
					<View
						key={idx}
						style={idx % 2 === 1 ? styles.clauseRowAlt : styles.clauseRow}
						wrap={false}
					>
						<Text style={styles.clauseNumber}>{String(idx + 1).padStart(2, "0")}</Text>
						<Text style={styles.clauseText}>{clause}</Text>
					</View>
				))}
			</View>
		</View>
	);
};

/**
 * Generic bordered table reusing the navy commission-table styling.
 * The container wraps across pages while each row stays intact (`wrap={false}`),
 * so a single row never splits over a page break — mirrors the ClausesList model.
 *
 * `columns[].flex` controls width; `align` controls cell text alignment. Pass the
 * same column shape to the header and every row so they line up.
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
}) => (
	<View style={styles.commissionTable}>
		<View style={styles.commissionHeaderRow} wrap={false}>
			{columns.map((c, i) => (
				<Text
					key={i}
					style={[
						styles.commissionHeaderCell,
						{ flex: c.flex ?? 1, textAlign: c.align ?? "left" },
						i === columns.length - 1 ? { borderRightWidth: 0 } : {},
					]}
				>
					{c.header}
				</Text>
			))}
		</View>
		{rows.map((cells, r) => (
			<View key={r} style={r % 2 === 1 ? styles.commissionRowAlt : styles.commissionRow} wrap={false}>
				{cells.map((cell, i) => {
					const col = columns[i];
					const isLabel = i === 0;
					return (
						<Text
							key={i}
							style={[
								isLabel ? styles.commissionLabelCell : styles.commissionDataCell,
								{ flex: col?.flex ?? 1, textAlign: col?.align ?? (isLabel ? "left" : "right") },
								i === cells.length - 1 ? { borderRightWidth: 0 } : {},
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

export const SignatureBlock = ({
	label = "Signatures",
	signers,
	accentColor,
}: {
	label?: string;
	signers: { role: string; name?: string }[];
	/** When set, a thin bar of this color is rendered below each signature label
	 *  (matches the Avera reference's navy bars). */
	accentColor?: string;
}) => (
	<View style={styles.section} wrap={false}>
		<SectionTitle title={label} />
		<View style={styles.signatureRow}>
			{signers.map((s, i) => (
				<View key={i} style={styles.signatureBox}>
					<View style={styles.signatureLine} />
					<Text style={styles.signatureLabel}>{s.role}</Text>
					{s.name ? <Text style={styles.signatureSubLabel}>{s.name}</Text> : null}
					{accentColor ? (
						<View style={[styles.signatureAccentBar, { backgroundColor: accentColor }]} />
					) : null}
				</View>
			))}
		</View>
	</View>
);

export const PageFooter = () => {
	const { teamName } = useBranding();
	return (
	<View style={styles.footer} fixed>
		<Text style={styles.footerText}>{teamName}</Text>
		<Text
			style={styles.pageNumber}
			render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
		/>
		<Text style={styles.footerText}>
			Confidential {"•"} {new Date().getFullYear()}
		</Text>
	</View>
	);
};

export { colors };
