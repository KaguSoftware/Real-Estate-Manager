import type {
	DocKind,
	InventoryItem,
	LeaseTerm,
	TaxResponsibility,
	UtilityResponsibility,
} from "@/src/lib/db/types";

export type { DocKind, TaxResponsibility, UtilityResponsibility, InventoryItem };

/**
 * Turkish residential lease (konut kira sözleşmesi). Mirrors SalesPDFData's
 * richness: PartyInfo cards for each party, structured property/lease blocks,
 * per-utility responsibility, demirbaş (inventory) list and free-text notes.
 */
export interface RentalPDFData {
	landlord: PartyInfo;          // Kiraya Veren (Mal Sahibi)
	tenant: PartyInfo;            // Kiracı
	guarantor: PartyInfo | null;  // Kefil — optional
	property: {
		address: string;
		nitelik: string | null;     // e.g. "3+1"
		size_sqm: number | null;
		city: string | null;
		floor: string | null;
		unit_no: string | null;
	};
	lease: {
		term: LeaseTerm;
		start_date: string;
		end_date: string | null;
		monthly_rent: number;
		deposit: number;
		currency: string;
		payment_day: number | null;
		payment_method: string | null;
		bank_account: string | null;
	};
	utilities: {
		electricity: UtilityResponsibility;
		water: UtilityResponsibility;
		gas: UtilityResponsibility;
		internet: UtilityResponsibility;
		aidat: UtilityResponsibility;
	};
	subletting_allowed: boolean;
	rent_increase_note: string | null;
	inventory: InventoryItem[];
	condition_notes: string | null;
	special_conditions: string | null;
	/** Raw clause templates (with {tokens}); omitted = built-in defaults. */
	clauses?: string[];
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
		city: string | null;        // jurisdiction city for the courts clause
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
	/** Raw clause templates (with {tokens}); omitted = built-in defaults. */
	clauses?: string[];
	generatedAt: string; // ISO timestamp
}

/** Rent receipt (kira makbuzu) for a single recorded payment. */
export interface ReceiptPDFData {
	landlord_name: string;
	tenant_name: string;
	property_address: string;
	city: string | null;
	period_start: string;   // ISO date
	period_end: string;     // ISO date
	amount: number;
	currency: string;
	method: string | null;
	paid_at: string | null; // ISO date
	generatedAt: string;    // ISO timestamp
}

/**
 * Client-facing property listing — shared over WhatsApp instead of typing
 * out details. Photos first, then the public-facing summary. Deliberately
 * omits homeowner name and title-deed (tapu) fields.
 */
export interface ListingPDFData {
	address_line: string;
	city: string | null;
	listing_type: "for_rent" | "for_sale";
	nitelik: string | null;      // e.g. "3+1"
	bedrooms: number | null;
	bathrooms: number | null;
	size_sqm: number | null;
	list_price: number | null;
	currency: string;
	notes: string | null;        // shown as the description
	images: string[];            // public CDN URLs, hero first
	generatedAt: string;         // ISO timestamp
}

/**
 * Multi-property brochure — a selection from the portfolio shared with one
 * client as a single file, one page per property.
 *
 * Each entry is a ListingPDFData, so the same privacy guarantee applies
 * structurally: there is no field for homeowner name or tapu data, so none can
 * leak. Photos are limited to the cover image per property (see the bulk
 * action) — inlining every gallery photo as base64 would produce a file too
 * large to render on a phone or send over WhatsApp.
 */
export interface BrochurePDFData {
	properties: ListingPDFData[];
	generatedAt: string; // ISO timestamp
}

export type PDFDataByKind = {
	rental:   RentalPDFData;
	sales:    SalesPDFData;
	receipt:  ReceiptPDFData;
	listing:  ListingPDFData;
	brochure: BrochurePDFData;
};
