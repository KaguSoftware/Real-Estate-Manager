import { Document, Page, pdf } from "@react-pdf/renderer";
import { styles, ensurePdfFonts } from "./styles";
import type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData } from "./types";
import { RentalAgreement } from "./sections/rental";
import { SalesAgreement } from "./sections/sales";
import { RentReceipt } from "./sections/receipt";
import { PropertyListing } from "./sections/listing";

type AnyPDFData = RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData;

export function PDFDocument({ kind, data }: { kind: DocKind; data: AnyPDFData }) {
	// Register fonts at render time (client-side, where window exists). This
	// covers the BlobProvider preview path, which renders PDFDocument directly.
	ensurePdfFonts();
	const titleByKind: Record<DocKind, string> = {
		rental: "Rental Agreement",
		sales: "Sales Agreement",
		receipt: "Rent Receipt",
		listing: "Property Listing",
	};
	return (
		<Document title={titleByKind[kind]} author="Kagu Real Estate">
			<Page size="A4" style={styles.page} wrap>
				{kind === "rental"  && <RentalAgreement data={data as RentalPDFData} />}
				{kind === "sales"   && <SalesAgreement data={data as SalesPDFData} />}
				{kind === "receipt" && <RentReceipt data={data as ReceiptPDFData} />}
				{kind === "listing" && <PropertyListing data={data as ListingPDFData} />}
			</Page>
		</Document>
	);
}

export async function generatePDFBlob(kind: DocKind, data: AnyPDFData): Promise<Blob> {
	ensurePdfFonts();
	return pdf(<PDFDocument kind={kind} data={data} />).toBlob();
}
