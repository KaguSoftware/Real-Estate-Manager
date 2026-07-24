// Database row types for the real estate schema.
// Matches the columns defined in supabase/migrations/ (0001_init.sql onward).

export type GlobalRole     = "admin" | "member" | "client";
export type ListingType    = "for_rent" | "for_sale";
export type PropertyStatus = "vacant" | "occupied" | "sold";
export type LeaseTerm      = "1yr" | "2yr" | "undefined";
export type LeaseStatus    = "active" | "ended" | "terminated";
/** Who pays a given utility on a rental. */
export type UtilityResponsibility = "tenant" | "landlord" | "shared";
export type LeadStatus     = "new" | "called_rejected" | "follow_up" | "interested" | "closed";

export interface Profile {
	id: string;
	email: string;
	display_name: string | null;
	full_name: string | null;
	phone: string | null;
	/** Path inside the avatars bucket, or null when no picture uploaded. */
	avatar_path: string | null;
	app_role: GlobalRole;
	created_at: string;
	updated_at: string;
}
export type ProfileRow = Profile;

export interface Property {
	id: string;
	team_id: string;
	created_by: string | null;
	/** Team member responsible for this property (responsibility only — whole team can see it). */
	assigned_to: string | null;
	homeowner_name: string;
	address_line: string;
	city: string | null;
	size_sqm: number | null;
	bedrooms: number | null;
	bathrooms: number | null;
	/** NULL = unknown; true = furnished; false = unfurnished. */
	furnished: boolean | null;
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
	/** Construction project this unit belongs to, when it is a project unit. */
	project_id: string | null;
	/** New-build vs. second-hand. Independent of project_id — a new build may
	 *  be recorded without a project row. */
	is_new_build: boolean;
	created_at: string;
	updated_at: string;
}

/**
 * A construction-company project. Holds the Google Drive link the developer
 * shares with the agency (catalogs, drone footage, price lists) — inventory
 * that never appears on public portals. Linked property rows are optional.
 */
export interface Project {
	id: string;
	team_id: string;
	created_by: string | null;
	name: string;
	/** Construction company — groups projects by developer. */
	developer_name: string | null;
	drive_url: string | null;
	city: string | null;
	mahalle: string | null;
	delivery_date: string | null;
	/** Entry price, so projects with no unit rows can still meet a budget. */
	price_from: number | null;
	price_currency: string;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

/** Agent-entered interaction kinds. Not a row-mutation audit log. */
export type ActivityKind =
	| "call"
	| "whatsapp"
	| "meeting"
	| "viewing"
	| "note"
	| "status_change";

/**
 * One recorded interaction with a contact. Replaces the lossy
 * `last_call_at` + "[tarih] Arandı." -in-notes workaround: history is now
 * structured, attributed, and safe from a notes-field overwrite.
 *
 * Exactly one of lead_id / tenant_id is set (DB CHECK enforces it).
 */
export interface ContactActivity {
	id: string;
	team_id: string;
	created_by: string | null;
	lead_id: string | null;
	tenant_id: string | null;
	kind: ActivityKind;
	body: string | null;
	/** Property the interaction was about; survives that property's deletion. */
	property_id: string | null;
	occurred_at: string;
	created_at: string;
}

export interface Tenant {
	id: string;
	team_id: string;
	created_by: string | null;
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
	team_id: string;
	created_by: string | null;
	/** Team member responsible for this lead. */
	assigned_to: string | null;
	full_name: string;
	phone: string | null;
	email: string | null;
	interested_in: string | null;
	// Optional structured prefs — power the "Find matches" link into property filters.
	pref_listing_type: ListingType | null;
	pref_nitelik: string | null;
	pref_min_bedrooms: number | null;
	pref_location: string | null;
	/** Budget floor; null = open-ended. Only meaningful alongside pref_currency. */
	pref_min_price: number | null;
	/** Budget ceiling; null = open-ended. */
	pref_max_price: number | null;
	/** Currency the budget is stated in. No FX conversion anywhere — a budget
	 *  is only ever compared against a property priced in the same currency. */
	pref_currency: string;
	status: LeadStatus;
	notes: string | null;
	last_call_at: string | null;
	created_at: string;
	updated_at: string;
}

/** A single demirbaş (inventory) line on a rental. */
export interface InventoryItem {
	item: string;
	qty: number | null;
	note: string | null;
}

export interface Lease {
	id: string;
	team_id: string;
	created_by: string | null;
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
	// Turkish kira-sözleşmesi fields — see migration 0007_rental_kira.sql.
	guarantor_id: string | null;
	payment_day: number | null;
	payment_method: string | null;
	bank_account: string | null;
	util_electricity: UtilityResponsibility;
	util_water: UtilityResponsibility;
	util_gas: UtilityResponsibility;
	util_internet: UtilityResponsibility;
	util_aidat: UtilityResponsibility;
	subletting_allowed: boolean;
	rent_increase_note: string | null;
	inventory: InventoryItem[];
	condition_notes: string | null;
	special_conditions: string | null;
	created_at: string;
	updated_at: string;
}

export interface Payment {
	id: string;
	team_id: string;
	created_by: string | null;
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
	team_id: string;
	created_by: string | null;
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
	team_id: string;
	created_by: string | null;
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
export type DocKind = "rental" | "sales" | "receipt" | "listing" | "brochure";
