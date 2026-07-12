// Renders editor documents through the real react-pdf pipeline (Node build)
// to lock the mapper's resilience contract: valid docs produce a PDF, and
// malformed/unknown nodes degrade instead of crashing the render.

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { EditorPDFDocument } from "./document";
import { buildRentalInitialDoc } from "@/src/lib/documents/buildInitialDoc";
import { BLOCK, paragraph, text, type EditorDocJSON } from "@/src/lib/documents/blocks";
import type { PartyInfo, RentalPDFData } from "./types";

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

const party = (name: string): PartyInfo => ({
	full_name: name,
	address: "Örnek Mah. Test Sk. No:1, İstanbul",
	national_id: "12345678901",
	tax_no: null,
	tax_office: null,
	phone: "+90 555 111 22 33",
	email: null,
});

const rentalData: RentalPDFData = {
	landlord: party("Ayşe Yılmaz"),
	tenant: party("Mehmet Demir"),
	guarantor: null,
	property: { address: "Çınar Apt. D:4, Kadıköy", nitelik: "3+1", size_sqm: 120, city: "İstanbul", floor: null, unit_no: null },
	lease: {
		term: "1yr", start_date: "2026-08-01", end_date: "2027-08-01",
		monthly_rent: 25000, deposit: 50000, currency: "TRY",
		payment_day: 5, payment_method: "Havale", bank_account: null,
	},
	utilities: { electricity: "tenant", water: "tenant", gas: "tenant", internet: "tenant", aidat: "tenant" },
	subletting_allowed: false,
	rent_increase_note: null,
	inventory: [{ item: "Klima", qty: 2, note: null }],
	condition_notes: null,
	special_conditions: null,
	generatedAt: "2026-07-12T10:00:00.000Z",
};

const render = (doc: EditorDocJSON) =>
	renderToBuffer(
		<EditorPDFDocument
			kind="rental"
			title="Konut Kira Sözleşmesi"
			subtitle="Çınar Apt. D:4, Kadıköy"
			doc={doc}
			sourceData={rentalData}
		/>,
	);

describe("EditorPDFDocument", () => {
	it("renders a full initial rental document to a valid PDF", async () => {
		const buf = await render(buildRentalInitialDoc(rentalData));
		expect(buf.length).toBeGreaterThan(5000);
		expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
	});

	it("renders rich content: marks, lists, headings, tables, callouts", async () => {
		const doc: EditorDocJSON = {
			type: BLOCK.doc,
			content: [
				{ type: BLOCK.heading, attrs: { level: 2 }, content: [text("Başlık")] },
				{ type: BLOCK.paragraph, content: [
					text("Normal "),
					text("kalın", [{ type: "bold" }]),
					text(" ve "),
					text("altı çizili", [{ type: "underline" }]),
					{ type: BLOCK.hardBreak },
					text("yeni satır."),
				] },
				{ type: BLOCK.bulletList, content: [
					{ type: BLOCK.listItem, content: [paragraph("Birinci")] },
					{ type: BLOCK.listItem, content: [paragraph("İkinci")] },
				] },
				{ type: BLOCK.table, content: [
					{ type: BLOCK.tableRow, content: [
						{ type: BLOCK.tableHeader, content: [paragraph("Sütun A")] },
						{ type: BLOCK.tableHeader, content: [paragraph("Sütun B")] },
					] },
					{ type: BLOCK.tableRow, content: [
						{ type: BLOCK.tableCell, content: [paragraph("1")] },
						{ type: BLOCK.tableCell, content: [paragraph("2")] },
					] },
				] },
				{ type: BLOCK.callout, attrs: { tone: "warning" }, content: [text("Dikkat!")] },
			],
		};
		const buf = await render(doc);
		expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
	});

	it("survives unknown and malformed nodes (resilience contract)", async () => {
		const doc: EditorDocJSON = {
			type: BLOCK.doc,
			content: [
				{ type: "someFutureNode", content: [paragraph("gömülü metin")] },
				{ type: BLOCK.partyCard, attrs: { role: "Kiracı" } },        // missing party
				{ type: BLOCK.moneyPair, attrs: {} },                        // missing sides
				{ type: BLOCK.kvCard, attrs: { title: "X", items: "oops" } },// items not an array
				paragraph("Sonraki içerik hâlâ görünür."),
			],
		};
		const buf = await render(doc);
		expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
	});

	it("honors explicit page breaks (cover + 2 body pages)", async () => {
		const doc: EditorDocJSON = {
			type: BLOCK.doc,
			content: [
				paragraph("Sayfa bir."),
				{ type: BLOCK.pageBreak },
				paragraph("Sayfa iki."),
			],
		};
		const buf = await render(doc);
		const pages = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
		expect(pages.length).toBeGreaterThanOrEqual(3);
	});
});
