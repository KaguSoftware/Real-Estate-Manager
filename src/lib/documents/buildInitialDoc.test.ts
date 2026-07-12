import { describe, expect, it } from "vitest";
import { buildInitialDoc, buildRentalInitialDoc, buildSalesInitialDoc } from "./buildInitialDoc";
import { BLOCK, plainText, type DocNode } from "./blocks";
import type { PartyInfo, RentalPDFData, SalesPDFData } from "@/src/lib/pdf/types";

const party = (name: string): PartyInfo => ({
	full_name: name,
	address: "Örnek Mah. Test Sk. No:1, İstanbul",
	national_id: "12345678901",
	tax_no: null,
	tax_office: null,
	phone: "+90 555 111 22 33",
	email: null,
});

function rentalData(overrides: Partial<RentalPDFData> = {}): RentalPDFData {
	return {
		landlord: party("Ayşe Yılmaz"),
		tenant: party("Mehmet Demir"),
		guarantor: null,
		property: {
			address: "Çınar Apt. D:4, Kadıköy, İstanbul",
			nitelik: "3+1",
			size_sqm: 120,
			city: "İstanbul",
			floor: "2",
			unit_no: "4",
		},
		lease: {
			term: "1yr",
			start_date: "2026-08-01",
			end_date: "2027-08-01",
			monthly_rent: 25000,
			deposit: 50000,
			currency: "TRY",
			payment_day: 5,
			payment_method: "Havale",
			bank_account: "TR00 0000 0000 0000 0000 0000 00",
		},
		utilities: { electricity: "tenant", water: "tenant", gas: "tenant", internet: "tenant", aidat: "tenant" },
		subletting_allowed: false,
		rent_increase_note: null,
		inventory: [],
		condition_notes: null,
		special_conditions: null,
		generatedAt: "2026-07-12T10:00:00.000Z",
		...overrides,
	};
}

function salesData(overrides: Partial<SalesPDFData> = {}): SalesPDFData {
	return {
		seller: party("Ali Kaya"),
		buyer: party("Zeynep Acar"),
		property: {
			address: "Palmiye Sitesi B/7, Beylikdüzü, İstanbul",
			nitelik: "Daire",
			yuz_olcumu: "145",
			durum: "for_sale",
			ada_no: "101",
			parsel_no: "7",
			mahalle: "Cumhuriyet",
			mevkii: null,
			city: "İstanbul",
		},
		sale: {
			sale_price: 5250000,
			currency: "TRY",
			sale_date: "2026-07-12",
			target_close_date: "2026-09-30",
			deposit_amount: 250000,
			penalty_amount: 500000,
			validity_days: 60,
			tax_responsibility: "buyer",
		},
		commission: {
			buyer: { rate: 2, matrah: 105000, kdv: 21000, total: 126000 },
			seller: { rate: 2, matrah: 105000, kdv: 21000, total: 126000 },
		},
		special_conditions: null,
		generatedAt: "2026-07-12T10:00:00.000Z",
		...overrides,
	};
}

const types = (doc: { content: DocNode[] }) => doc.content.map((n) => n.type);
const byType = (doc: { content: DocNode[] }, t: string) => doc.content.filter((n) => n.type === t);

describe("buildRentalInitialDoc", () => {
	it("mirrors the classic section order without a guarantor", () => {
		const doc = buildRentalInitialDoc(rentalData());
		expect(types(doc)).toEqual([
			BLOCK.sectionChip, BLOCK.partyCard,    // A landlord
			BLOCK.sectionChip, BLOCK.partyCard,    // B tenant
			BLOCK.sectionChip, BLOCK.kvCard,       // C property
			BLOCK.sectionChip, BLOCK.moneyPair,    // D rent+deposit
			BLOCK.kvCard,                          //   lease facts
			BLOCK.sectionChip, BLOCK.table,        // E utilities
			BLOCK.sectionChip, BLOCK.clauseList,   // hükümler
			BLOCK.signatureBlock,
		]);
	});

	it("adds guarantor card, inventory table, notes and warning callout when present", () => {
		const doc = buildRentalInitialDoc(rentalData({
			guarantor: party("Kefil Kişi"),
			inventory: [{ item: "Klima", qty: 2, note: "Salon + yatak odası" }],
			condition_notes: "Boyalı, temiz teslim.",
			special_conditions: "Evcil hayvan beslenemez.",
			lease: { ...rentalData().lease, deposit: 100000 }, // > 3× rent → callout
		}));
		expect(byType(doc, BLOCK.partyCard)).toHaveLength(3);
		expect(byType(doc, BLOCK.table)).toHaveLength(2);
		expect(byType(doc, BLOCK.callout)).toHaveLength(1);
		const signers = (byType(doc, BLOCK.signatureBlock)[0].attrs as { signers: unknown[] }).signers;
		expect(signers).toHaveLength(3);
	});

	it("interpolates clause tokens with real values (WYSIWYG)", () => {
		const doc = buildRentalInitialDoc(rentalData());
		const clauses = byType(doc, BLOCK.clauseList)[0];
		const joined = (clauses.content ?? []).map(plainText).join(" ");
		expect(joined).not.toContain("{monthly_rent}");
		expect(joined).toContain("25.000 TRY");
	});

	it("uses a team clause template when provided", () => {
		const doc = buildRentalInitialDoc(rentalData({ clauses: ["Tek madde: kira {monthly_rent} {currency}."] }));
		const clauses = byType(doc, BLOCK.clauseList)[0];
		expect(clauses.content).toHaveLength(1);
		expect(plainText(clauses.content![0])).toBe("Tek madde: kira 25.000 TRY.");
	});
});

describe("buildSalesInitialDoc", () => {
	it("builds the sales structure with commission table and money pair", () => {
		const doc = buildSalesInitialDoc(salesData(), "Kagu Gayrimenkul");
		expect(types(doc)).toEqual([
			BLOCK.sectionChip, BLOCK.partyCard,    // A seller
			BLOCK.sectionChip, BLOCK.partyCard,    // B buyer
			BLOCK.sectionChip, BLOCK.kvCard,       // C property
			BLOCK.sectionChip, BLOCK.table,        // D commission
			BLOCK.moneyPair,
			BLOCK.paragraph,                       // connective line
			BLOCK.sectionChip, BLOCK.clauseList,
			BLOCK.signatureBlock,
		]);
	});

	it("resolves agency and jurisdiction into the clauses", () => {
		const doc = buildSalesInitialDoc(salesData(), "Kagu Gayrimenkul");
		const clauses = byType(doc, BLOCK.clauseList)[0];
		const joined = (clauses.content ?? []).map(plainText).join(" ");
		expect(joined).toContain("KAGU GAYRİMENKUL");
		expect(joined).toContain("İstanbul mahkemeleri");
		expect(joined).not.toContain("{agency_name}");
	});
});

describe("buildInitialDoc", () => {
	it("dispatches by kind", () => {
		expect(buildInitialDoc("rental", rentalData(), "X").content[0].type).toBe(BLOCK.sectionChip);
		expect(byType(buildInitialDoc("sales", salesData(), "X") as { content: DocNode[] }, BLOCK.moneyPair)).toHaveLength(1);
	});
});
