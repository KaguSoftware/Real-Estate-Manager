import type { DocKind, LeaseTerm, TaxResponsibility } from "@/src/lib/db/types";

export type { DocKind, TaxResponsibility };

export interface RentalPDFData {
	property: {
		homeowner_name: string;
		address_line: string;
		city: string | null;
		size_sqm: number | null;
	};
	tenant: {
		full_name: string;
		email: string | null;
		phone: string | null;
		national_id: string | null;
	};
	lease: {
		term: LeaseTerm;
		start_date: string;
		end_date: string | null;
		monthly_rent: number;
		deposit: number;
		currency: string;
	};
	additionalClauses?: string;
	generatedAt: string; // ISO timestamp
}

export interface PartyInfo {
	full_name: string;
	address: string;
	national_id: string | null;   // T.C. Kimlik No
	tax_no: string | null;        // Vergi No
	tax_office: string | null;    // Vergi Dairesi (V.Daire)
	phone: string | null;
	email: string | null;
}

export interface CommissionLine {
	rate: number | null;          // %, e.g. 2 = 2 %
	matrah: number | null;        // sale_price * rate / 100
	kdv: number | null;           // matrah * 0.18
	total: number | null;         // matrah + kdv
}

export interface SalesPDFData {
	seller: PartyInfo;            // Mal Sahibi
	buyer:  PartyInfo;            // Alıcı
	property: {
		address: string;
		nitelik: string | null;     // type/kind
		yuz_olcumu: string | null;  // size (rendered with "m²")
		durum: string | null;       // status
		ada_no: string | null;
		parsel_no: string | null;
		mahalle: string | null;
		mevkii: string | null;
	};
	sale: {
		sale_price: number;
		currency: string;
		sale_date: string;
		target_close_date: string | null;
		deposit_amount: number | null;
		penalty_amount: number | null;
		validity_days: number | null;
		tax_responsibility: TaxResponsibility;
	};
	commission: {
		buyer:  CommissionLine;
		seller: CommissionLine;
	};
	special_conditions: string | null;
	generatedAt: string; // ISO timestamp
}

// Stubbed for v2.
export interface ReceiptPDFData { _stub?: true }

export type PDFDataByKind = {
	rental:  RentalPDFData;
	sales:   SalesPDFData;
	receipt: ReceiptPDFData;
};
