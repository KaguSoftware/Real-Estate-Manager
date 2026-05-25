import { Document, Page, pdf } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData } from "./types";
import { RentalAgreement } from "./sections/rental";
import { SalesAgreementStub } from "./sections/sales";
import { RentReceiptStub } from "./sections/receipt";

type AnyPDFData = RentalPDFData | SalesPDFData | ReceiptPDFData;

export function PDFDocument({ kind, data }: { kind: DocKind; data: AnyPDFData }) {
	const titleByKind: Record<DocKind, string> = {
		rental: "Rental Agreement",
		sales: "Sales Agreement",
		receipt: "Rent Receipt",
	};
	return (
		<Document title={titleByKind[kind]} author="Real Estate Manager">
			<Page size="A4" style={styles.page} wrap>
				{kind === "rental"  && <RentalAgreement data={data as RentalPDFData} />}
				{kind === "sales"   && <SalesAgreementStub />}
				{kind === "receipt" && <RentReceiptStub />}
			</Page>
		</Document>
	);
}

export async function generatePDFBlob(kind: DocKind, data: AnyPDFData): Promise<Blob> {
	return pdf(<PDFDocument kind={kind} data={data} />).toBlob();
}
