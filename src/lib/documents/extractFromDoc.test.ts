import { describe, expect, it } from "vitest";
import { buildRentalInitialDoc, buildSalesInitialDoc } from "./buildInitialDoc";
import {
	extractRentalFromDoc,
	extractSalesFromDoc,
	parseTrDate,
	parseTrNumber,
	parseTermLabel,
} from "./extractFromDoc";
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

const rentalData = (): RentalPDFData => ({
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
});

const salesData = (): SalesPDFData => ({
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
		target_close_date: null,
		deposit_amount: 250000,
		penalty_amount: null,
		validity_days: null,
		tax_responsibility: "buyer",
	},
	commission: {
		buyer: { rate: 2, matrah: 105000, kdv: 21000, total: 126000 },
		seller: { rate: 2, matrah: 105000, kdv: 21000, total: 126000 },
	},
	special_conditions: null,
	generatedAt: "2026-07-12T10:00:00.000Z",
});

describe("parseTrNumber", () => {
	it("parses grouped and decimal tr-TR amounts", () => {
		expect(parseTrNumber("25.000")).toBe(25000);
		expect(parseTrNumber("25.000,50")).toBe(25000.5);
		expect(parseTrNumber("1.234.567")).toBe(1234567);
		expect(parseTrNumber("2500")).toBe(2500);
		expect(parseTrNumber("2,5")).toBe(2.5);
		expect(parseTrNumber("25 000 TL")).toBe(25000);
	});
	it("rejects garbage", () => {
		expect(parseTrNumber("")).toBeNull();
		expect(parseTrNumber("abc")).toBeNull();
		expect(parseTrNumber(null)).toBeNull();
		expect(parseTrNumber("—")).toBeNull();
	});
});

describe("parseTrDate", () => {
	it("parses Turkish long dates and numeric formats", () => {
		expect(parseTrDate("12 Temmuz 2026")).toBe("2026-07-12");
		expect(parseTrDate("1 Ağustos 2026")).toBe("2026-08-01");
		expect(parseTrDate("01.02.2026")).toBe("2026-02-01");
		expect(parseTrDate("12/07/2026")).toBe("2026-07-12");
		expect(parseTrDate("2026-07-12")).toBe("2026-07-12");
	});
	it("rejects unreadable or impossible dates", () => {
		expect(parseTrDate("yarın")).toBeNull();
		expect(parseTrDate("31 Şubat 2026")).toBeNull();
		expect(parseTrDate("")).toBeNull();
		expect(parseTrDate("—")).toBeNull();
	});
});

describe("parseTermLabel", () => {
	it("maps template labels back to lease terms", () => {
		expect(parseTermLabel("1 Yıl")).toBe("1yr");
		expect(parseTermLabel("2 Yıl")).toBe("2yr");
		expect(parseTermLabel("Belirsiz süreli")).toBe("undefined");
		expect(parseTermLabel("3 Yıl")).toBeNull();
	});
});

describe("extractRentalFromDoc (round-trip with buildRentalInitialDoc)", () => {
	it("recovers the structured data the doc was built from", () => {
		const data = rentalData();
		const doc = buildRentalInitialDoc(data);
		const ex = extractRentalFromDoc(doc);
		expect(ex.landlord?.full_name).toBe("Ayşe Yılmaz");
		expect(ex.tenant?.full_name).toBe("Mehmet Demir");
		expect(ex.tenant?.phone).toBe("+90 555 111 22 33");
		expect(ex.guarantor).toBeNull();
		expect(ex.monthlyRent).toBe(25000);
		expect(ex.deposit).toBe(50000);
		expect(ex.currency).toBe("TRY");
		expect(ex.term).toBe("1yr");
		expect(ex.startDate).toBe("2026-08-01");
		expect(ex.paymentDay).toBe(5);
		expect(ex.paymentMethod).toBe("Havale");
		expect(ex.bankAccount).toBe("TR00 0000 0000 0000 0000 0000 00");
	});

	it("finds the guarantor card when present", () => {
		const data = { ...rentalData(), guarantor: party("Kemal Öz") };
		const ex = extractRentalFromDoc(buildRentalInitialDoc(data));
		expect(ex.guarantor?.full_name).toBe("Kemal Öz");
	});

	it("reports raw text when a user mangles the start date", () => {
		const doc = buildRentalInitialDoc(rentalData());
		for (const node of doc.content) {
			if (node.type !== "kvCard") continue;
			const items = (node.attrs as { items?: { label: string; value: string }[] }).items;
			const row = items?.find((it) => it.label === "Başlangıç");
			if (row) row.value = "önümüzdeki ay";
		}
		const ex = extractRentalFromDoc(doc);
		expect(ex.startDate).toBeNull();
		expect(ex.startDateRaw).toBe("önümüzdeki ay");
	});
});

describe("extractSalesFromDoc (round-trip with buildSalesInitialDoc)", () => {
	it("recovers seller, buyer and amounts", () => {
		const doc = buildSalesInitialDoc(salesData(), "Kagu Real Estate");
		const ex = extractSalesFromDoc(doc);
		expect(ex.seller?.full_name).toBe("Ali Kaya");
		expect(ex.buyer?.full_name).toBe("Zeynep Acar");
		expect(ex.salePrice).toBe(5250000);
		expect(ex.depositAmount).toBe(250000);
		expect(ex.currency).toBe("TRY");
	});

	it("treats a dash kapora as null", () => {
		const data = salesData();
		data.sale.deposit_amount = null; // builder renders "—"
		const ex = extractSalesFromDoc(buildSalesInitialDoc(data, "Kagu Real Estate"));
		expect(ex.depositAmount).toBeNull();
	});
});
