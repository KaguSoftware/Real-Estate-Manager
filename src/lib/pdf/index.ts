import type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData } from "./types";

export type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData };
export { PDFDocument } from "./document";

/** Render a document to a PDF File without downloading it — callers can
 *  download and/or upload the same bytes (see exportToPDF / uploadDocumentPdf). */
export async function generatePdfFile(
	kind: DocKind,
	data: RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData,
	filename: string,
): Promise<File> {
	// Dynamic import keeps @react-pdf/renderer out of the SSR bundle
	const { generatePDFBlob } = await import("./document");
	// Ensure embedded fonts are fully loaded before rendering, otherwise text
	// is laid out with fallback metrics and lines collapse onto each other.
	const { loadPdfFonts } = await import("./styles");
	await loadPdfFonts();
	const blob = await generatePDFBlob(kind, data);

	const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	return new File([blob], safeFilename, { type: "application/pdf" });
}

export async function exportToPDF(
	kind: DocKind,
	data: RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData,
	filename: string,
) {
	const file = await generatePdfFile(kind, data, filename);
	await downloadPdfFile(file);
}

/** Hand a rendered PDF to the user: native share sheet on mobile, download otherwise. */
export async function downloadPdfFile(file: File) {
	const safeFilename = file.name;
	const blob = file;

	// On iOS/mobile, use the Web Share API (triggers the native "Save to Files" sheet).
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isMobile = isIOS || /Android/i.test(navigator.userAgent);

	if (isMobile && "canShare" in navigator && navigator.canShare({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: safeFilename });
			return;
		} catch (e) {
			if ((e as DOMException).name === "AbortError") return;
			// otherwise fall through to anchor click
		}
	}

	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = safeFilename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
