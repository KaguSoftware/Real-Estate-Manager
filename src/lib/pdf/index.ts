import type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData, BrochurePDFData } from "./types";
import type { PdfBranding } from "./branding";

export type { DocKind, RentalPDFData, SalesPDFData, ReceiptPDFData, ListingPDFData, BrochurePDFData };
export type { PdfBranding };
export { getPdfBrandingFromStore, DEFAULT_PALETTE, paletteFromColors } from "./branding";
export { PDFDocument, EditorPDFDocument } from "./document";
export type { EditorPDFProps } from "./document";

/** Render a document to a PDF File without downloading it — callers can
 *  download and/or upload the same bytes (see exportToPDF / uploadDocumentPdf). */
export async function generatePdfFile(
	kind: DocKind,
	data: RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData | BrochurePDFData,
	filename: string,
	branding?: PdfBranding,
): Promise<File> {
	// Dynamic import keeps @react-pdf/renderer out of the SSR bundle
	const { generatePDFBlob } = await import("./document");
	// Ensure embedded fonts are fully loaded before rendering, otherwise text
	// is laid out with fallback metrics and lines collapse onto each other.
	const { loadPdfFonts } = await import("./styles");
	await loadPdfFonts();
	const blob = await generatePDFBlob(kind, data, branding);

	const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	return new File([blob], safeFilename, { type: "application/pdf" });
}

/** Render an editor document (rental/sales contract from the block editor)
 *  to a PDF File. Same dynamic-import + font-gating policy as generatePdfFile. */
export async function generateEditorPdfFile(
	props: import("./document").EditorPDFProps,
	filename: string,
): Promise<File> {
	const { generateEditorPDFBlob } = await import("./document");
	const { loadPdfFonts } = await import("./styles");
	await loadPdfFonts();
	const blob = await generateEditorPDFBlob(props);
	const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	return new File([blob], safeFilename, { type: "application/pdf" });
}

export async function exportToPDF(
	kind: DocKind,
	data: RentalPDFData | SalesPDFData | ReceiptPDFData | ListingPDFData | BrochurePDFData,
	filename: string,
	branding?: PdfBranding,
) {
	const file = await generatePdfFile(kind, data, filename, branding);
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

/** Download a file that already lives at a URL (e.g. a Supabase signed URL for a
 *  stored PDF) without navigating the user. Fetching to a blob and clicking a
 *  synthetic anchor avoids the window.open(_blank) flash where the browser paints
 *  the signed-URL tab (a brief error/interstitial) before the PDF resolves. */
export async function downloadUrl(url: string, filename: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Dosya indirilemedi (${res.status})`);
	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
}
