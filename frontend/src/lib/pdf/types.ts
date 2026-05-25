import type { DocKind, LeaseTerm } from "@/src/lib/db/types";

export type { DocKind };

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

// Stubbed for v2.
export interface SalesPDFData { _stub?: true }
export interface ReceiptPDFData { _stub?: true }

export type PDFDataByKind = {
	rental:  RentalPDFData;
	sales:   SalesPDFData;
	receipt: ReceiptPDFData;
};
