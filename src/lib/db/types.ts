// Database row types for the real estate schema.
// Matches the columns defined in supabase/migrations/0006_real_estate.sql.

export type GlobalRole     = "admin" | "member" | "client";
export type ListingType    = "for_rent" | "for_sale";
export type PropertyStatus = "vacant" | "occupied" | "sold";
export type LeaseTerm      = "1yr" | "2yr" | "undefined";
export type LeaseStatus    = "active" | "ended" | "terminated";
export type LeadStatus     = "new" | "called_rejected" | "follow_up" | "interested" | "closed";

export interface Profile {
	id: string;
	email: string;
	display_name: string | null;
	app_role: GlobalRole;
	created_at: string;
	updated_at: string;
}
export type ProfileRow = Profile;

export interface Property {
	id: string;
	owner_id: string;
	homeowner_name: string;
	address_line: string;
	city: string | null;
	size_sqm: number | null;
	bedrooms: number | null;
	bathrooms: number | null;
	listing_type: ListingType;
	status: PropertyStatus;
	list_price: number | null;
	currency: string;
	notes: string | null;
	// Turkish title-deed (tapu) fields — optional; only sales agreement uses them.
	nitelik: string | null;
	ada_no: string | null;
	parsel_no: string | null;
	mahalle: string | null;
	mevkii: string | null;
	latitude: number | null;
	longitude: number | null;
	created_at: string;
	updated_at: string;
}

export interface Tenant {
	id: string;
	owner_id: string;
	full_name: string;
	email: string | null;
	phone: string | null;
	national_id: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface Lead {
	id: string;
	owner_id: string;
	full_name: string;
	phone: string | null;
	email: string | null;
	interested_in: string | null;
	// Optional structured prefs — power the "Find matches" link into property filters.
	pref_listing_type: ListingType | null;
	pref_nitelik: string | null;
	pref_min_bedrooms: number | null;
	pref_location: string | null;
	status: LeadStatus;
	notes: string | null;
	last_call_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface Lease {
	id: string;
	owner_id: string;
	property_id: string;
	tenant_id: string;
	term: LeaseTerm;
	start_date: string;
	end_date: string | null;
	monthly_rent: number;
	deposit: number;
	currency: string;
	status: LeaseStatus;
	document_pdf_path: string | null;
	created_at: string;
	updated_at: string;
}

export interface Payment {
	id: string;
	owner_id: string;
	lease_id: string;
	period_start: string;
	period_end: string;
	amount_due: number;
	amount_paid: number;
	paid_at: string | null;
	method: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface LeaseBalance {
	totalDue: number;
	totalPaid: number;
	balance: number;
}

export interface PropertyWithActiveLease extends Property {
	active_lease:
		| (Lease & {
				tenant: Tenant;
				balance: LeaseBalance;
		  })
		| null;
}

export interface PropertyImage {
	id: string;
	owner_id: string;
	property_id: string;
	storage_path: string;
	position: number;
	created_at: string;
	/** Populated client-side via supabase.storage.getPublicUrl(). */
	url: string;
}

export type SaleStatus = "active" | "closed" | "cancelled";
export type TaxResponsibility = "buyer" | "seller" | "legal";

export interface Sale {
	id: string;
	owner_id: string;
	property_id: string;
	buyer_id: string;
	sale_price: number;
	currency: string;
	sale_date: string;
	target_close_date: string | null;
	deposit_amount: number | null;
	penalty_amount: number | null;
	validity_days: number | null;
	tax_responsibility: TaxResponsibility;
	buyer_commission_rate: number | null;
	seller_commission_rate: number | null;
	special_conditions: string | null;
	status: SaleStatus;
	document_pdf_path: string | null;
	created_at: string;
	updated_at: string;
}

/** What the document wizard generates, plus the shareable property listing. */
export type DocKind = "rental" | "sales" | "receipt" | "listing";
