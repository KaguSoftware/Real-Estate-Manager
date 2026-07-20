// Locks the multi-page contract of PDFDocument. A brochure renders one page
// per selected property (plus the cover), while every pre-existing kind must
// keep rendering exactly one content page — the restructure that added
// brochures must not have changed them.

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "./document";
import type { BrochurePDFData, ListingPDFData, ReceiptPDFData } from "./types";

// In Node, react-pdf loads fonts straight from the filesystem via fontkit —
// register the same faces the browser path uses so Turkish glyphs shape.
beforeAll(() => {
	const fontsDir = path.resolve(__dirname, "../../../public/fonts");
	Font.register({
		family: "Sans",
		fonts: [
			{ src: path.join(fontsDir, "GoogleSansFlex_36pt-Regular.ttf"), fontWeight: 400 },
			{ src: path.join(fontsDir, "GoogleSansFlex_120pt-Medium.ttf"), fontWeight: 500 },
			{ src: path.join(fontsDir, "GoogleSansFlex_36pt-Bold.ttf"), fontWeight: 700 },
		],
	});
});

/** Count page objects in a rendered PDF. react-pdf emits one "/Type /Page"
 *  entry per page (the document catalog uses "/Type /Pages", which the word
 *  boundary excludes). */
function pageCount(buf: Buffer): number {
	return buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
}

const listing = (address: string, overrides: Partial<ListingPDFData> = {}): ListingPDFData => ({
	address_line: address,
	city: "İzmir",
	listing_type: "for_sale",
	nitelik: "3+1",
	bedrooms: 3,
	bathrooms: 1,
	size_sqm: 120,
	list_price: 5_000_000,
	currency: "TRY",
	notes: "Deniz manzaralı, asansörlü.",
	images: [],
	generatedAt: "2026-07-20T10:00:00.000Z",
	...overrides,
});

const brochure = (properties: ListingPDFData[]): BrochurePDFData => ({
	properties,
	generatedAt: "2026-07-20T10:00:00.000Z",
});

describe("brochure PDF", () => {
	it("renders one page per property, plus the cover", async () => {
		const buf = await renderToBuffer(
			<PDFDocument
				kind="brochure"
				data={brochure([
					listing("Kıbrıs Şehitleri Cd. 10"),
					listing("Alsancak Mah. 1453 Sk. 4"),
					listing("Mithatpaşa Cd. 220", { listing_type: "for_rent", list_price: 30_000 }),
				])}
			/>,
		);
		expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
		expect(pageCount(buf)).toBe(4); // cover + 3
	});

	it("renders a single-property brochure as cover + one page", async () => {
		const buf = await renderToBuffer(
			<PDFDocument kind="brochure" data={brochure([listing("Tek Taşınmaz Sk. 1")])} />,
		);
		expect(pageCount(buf)).toBe(2);
	});

	it("survives properties with no photo and no price", async () => {
		const buf = await renderToBuffer(
			<PDFDocument
				kind="brochure"
				data={brochure([
					listing("Fotoğrafsız Sk. 3", { list_price: null, images: [], notes: null }),
				])}
			/>,
		);
		expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
		expect(pageCount(buf)).toBe(2);
	});

	// The brochure restructure reshaped the content area for every kind; this
	// guards the four that existed before it.
	it("leaves single-page kinds at cover + one page", async () => {
		const receipt: ReceiptPDFData = {
			landlord_name: "Ayşe Yılmaz",
			tenant_name: "Mehmet Demir",
			property_address: "Çınar Apt. D:4, Kadıköy",
			city: "İstanbul",
			period_start: "2026-07-01",
			period_end: "2026-07-31",
			amount: 25_000,
			currency: "TRY",
			method: "Havale",
			paid_at: "2026-07-05",
			generatedAt: "2026-07-20T10:00:00.000Z",
		};
		expect(pageCount(await renderToBuffer(<PDFDocument kind="receipt" data={receipt} />))).toBe(2);
		expect(
			pageCount(await renderToBuffer(<PDFDocument kind="listing" data={listing("Tek İlan Sk. 2")} />)),
		).toBe(2);
	});
});
