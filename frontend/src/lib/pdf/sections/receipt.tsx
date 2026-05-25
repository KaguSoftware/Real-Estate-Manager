// TODO v2 — rent receipt PDF.

import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { DocHeader, PageFooter } from "./common";

export function RentReceiptStub() {
	return (
		<View>
			<DocHeader title="Rent Receipt" subtitle="Coming soon" />
			<Text style={styles.bodyText}>This document type is not implemented yet.</Text>
			<PageFooter />
		</View>
	);
}
