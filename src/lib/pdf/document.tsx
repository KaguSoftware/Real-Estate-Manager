import { Document, Page, pdf } from "@react-pdf/renderer";
import { styles, ensurePdfFonts } from "./styles";
import { BrandingContext, DEFAULT_BRANDING, type PdfBranding } from "./branding";
import type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData } from "./types";
import { RentalAgreement } from "./sections/rental";
import { SalesAgreement } from "./sections/sales";
import { RentReceipt } from "./sections/receipt";
import { PropertyListing } from "./sections/listing";
import { CoverPage, type CoverInfoItem } from "./sections/cover";
import { PageFooter, formatDate } from "./sections/common";

type AnyPDFData = RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData;

const fmtMoney = (n: number | null | undefined) =>
	(n == null ? 0 : n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Title/subtitle and the key facts shown on the branded cover page. */
function coverMeta(kind: DocKind, data: AnyPDFData): { title: string; subtitle?: string; info: CoverInfoItem[] } {
	switch (kind) {
		case "rental": {
			const d = data as RentalPDFData;
			return {
				title: "Konut Kira Sözleşmesi",
				subtitle: "Residential Lease Agreement",
				info: [
					{ label: "Taşınmaz", value: d.property.address },
					{ label: "Kiraya Veren", value: d.landlord.full_name },
					{ label: "Kiracı", value: d.tenant.full_name },
					{ label: "Aylık Kira", value: `${fmtMoney(d.lease.monthly_rent)} ${d.lease.currency}` },
					{ label: "Başlangıç", value: formatDate(d.lease.start_date) },
				],
			};
		}
		case "sales": {
			const d = data as SalesPDFData;
			return {
				title: "Satılık Alım, Satış Sözleşmesi",
				subtitle: "Sales Agreement",
				info: [
					{ label: "Gayrimenkul", value: d.property.address },
					{ label: "Mal Sahibi", value: d.seller.full_name },
					{ label: "Alıcı", value: d.buyer.full_name },
					{ label: "Satış Bedeli", value: `${fmtMoney(d.sale.sale_price)} ${d.sale.currency}` },
					{ label: "Tarih", value: formatDate(d.sale.sale_date) },
				],
			};
		}
		case "receipt": {
			const d = data as ReceiptPDFData;
			return {
				title: "Kira Makbuzu",
				subtitle: "Rent Receipt",
				info: [
					{ label: "Taşınmaz", value: d.property_address },
					{ label: "Kiraya Veren", value: d.landlord_name },
					{ label: "Kiracı", value: d.tenant_name },
					{ label: "Tutar", value: `${fmtMoney(d.amount)} ${d.currency}` },
					{ label: "Dönem", value: `${d.period_start} — ${d.period_end}` },
				],
			};
		}
		case "listing": {
			const d = data as ListingPDFData;
			return {
				title: "Property Listing",
				subtitle: d.listing_type === "for_rent" ? "For Rent / Kiralık" : "For Sale / Satılık",
				info: [
					{ label: "Address", value: d.address_line },
					{ label: "City", value: d.city ?? "" },
					{ label: "Type", value: d.nitelik ?? "" },
					{ label: "Size", value: d.size_sqm != null ? `${d.size_sqm} m²` : "" },
					{ label: "Price", value: d.list_price != null ? `${fmtMoney(d.list_price)} ${d.currency}` : "" },
				],
			};
		}
	}
}

export function PDFDocument({
	kind,
	data,
	branding,
}: {
	kind: DocKind;
	data: AnyPDFData;
	branding?: PdfBranding;
}) {
	// Register fonts at render time (client-side, where window exists). This
	// covers the BlobProvider preview path, which renders PDFDocument directly.
	ensurePdfFonts();
	const brand = branding ?? DEFAULT_BRANDING;
	const { title, subtitle, info } = coverMeta(kind, data);
	return (
		<BrandingContext.Provider value={brand}>
			<Document title={title} author={brand.teamName}>
				{/* Branded cover: logo, palette colors and the document's key facts. */}
				<Page size="A4" style={styles.page}>
					<CoverPage title={title} subtitle={subtitle} info={info} generatedAt={data.generatedAt} />
				</Page>
				<Page size="A4" style={styles.page} wrap>
					{kind === "rental"  && <RentalAgreement data={data as RentalPDFData} />}
					{kind === "sales"   && <SalesAgreement data={data as SalesPDFData} />}
					{kind === "receipt" && <RentReceipt data={data as ReceiptPDFData} />}
					{kind === "listing" && <PropertyListing data={data as ListingPDFData} />}
					{/* Direct child of Page so its absolute position is page-relative on
					    every page — inside a section View it would track the content
					    fragment and float mid-page on the last page. */}
					<PageFooter />
				</Page>
			</Document>
		</BrandingContext.Provider>
	);
}

export async function generatePDFBlob(kind: DocKind, data: AnyPDFData, branding?: PdfBranding): Promise<Blob> {
	ensurePdfFonts();
	return pdf(<PDFDocument kind={kind} data={data} branding={branding} />).toBlob();
}
