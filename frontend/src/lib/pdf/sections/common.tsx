// Small primitive components shared across PDF templates.
// English-only after the real-estate rehaul.

import { View, Text } from "@react-pdf/renderer";
import { styles, colors } from "../styles";

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
}) => (
	<View>
		<View style={styles.headerRow}>
			<View>
				<Text style={styles.docType}>{title}</Text>
				{subtitle ? <Text style={styles.refLine}>{subtitle}</Text> : null}
			</View>
			<View style={{ alignItems: "flex-end" }}>
				<Text style={styles.refLine}>{formatDate()}</Text>
			</View>
		</View>
		<View style={styles.dividerThick} />
	</View>
);

export const TextSection = ({ label, text }: { label: string; text: string }) => (
	<View style={styles.section}>
		<Text style={styles.sectionTitle}>{label}</Text>
		<Text style={styles.bodyText}>{text}</Text>
	</View>
);

export const TermsList = ({
	label,
	terms,
}: {
	label: string;
	terms: string[];
}) => {
	const filtered = terms.filter((t) => t && t.trim());
	if (filtered.length === 0) return <View />;
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{label}</Text>
			{filtered.map((clause, idx) => (
				<View key={idx} style={styles.termRow} wrap={false}>
					<View style={styles.termBadge}>
						<Text style={styles.termNumber}>{idx + 1}</Text>
					</View>
					<Text style={styles.termText}>{clause}</Text>
				</View>
			))}
		</View>
	);
};

export const SignatureBlock = ({
	label = "Signatures",
	signers,
}: {
	label?: string;
	signers: string[];
}) => (
	<View style={styles.section} wrap={false}>
		<Text style={styles.sectionTitle}>{label}</Text>
		<View style={styles.signatureRow}>
			{signers.map((signer, i) => (
				<View key={i} style={{ flex: 1 }}>
					<View style={styles.signatureLine} />
					<Text style={styles.labelSmall}>{signer}</Text>
				</View>
			))}
		</View>
	</View>
);

export const PageFooter = () => (
	<View style={styles.footer} fixed>
		<Text style={styles.footerText}>Real Estate Manager</Text>
		<Text
			style={styles.pageNumber}
			render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
		/>
		<Text style={styles.footerText}>
			Confidential {"•"} {new Date().getFullYear()}
		</Text>
	</View>
);

export const KVRow = ({ label, value }: { label: string; value: string }) => (
	<View>
		<Text style={styles.fieldLabel}>{label}</Text>
		<Text style={styles.fieldValue}>{value || "—"}</Text>
	</View>
);

export { colors };
