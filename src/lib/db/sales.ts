// Sales CRUD. Mirrors leases.ts. Owner-scoped via RLS.
// The partial unique index uniq_active_sale_per_property prevents two
// concurrent active sales on the same property — see migration 0003.

import type { Sale, SaleStatus, TaxResponsibility, Tenant } from "./types";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export interface SaleInput {
	property_id: string;
	buyer_id: string;
	sale_price: number;
	currency?: string;
	sale_date: string;             // ISO date
	target_close_date?: string | null;
	deposit_amount?: number | null;
	penalty_amount?: number | null;
	validity_days?: number | null;
	tax_responsibility?: TaxResponsibility;
	buyer_commission_rate?: number | null;
	seller_commission_rate?: number | null;
	special_conditions?: string | null;
	document_pdf_path?: string | null;
}


export async function createSale(input: SaleInput): Promise<Sale> {
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("sales")
		.insert({
			...input,
			team_id: requireTeamId(),
			created_by: user.id,
			currency: input.currency ?? "TRY",
			tax_responsibility: input.tax_responsibility ?? "legal",
		})
		.select()
		.single();
	if (error) throw error;
	return data as Sale;
}

export async function getSale(id: string): Promise<Sale> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("sales").select("*").eq("id", id).single();
	if (error) throw error;
	return data as Sale;
}

export async function getActiveSaleForProperty(
	propertyId: string,
): Promise<(Sale & { buyer: Tenant }) | null> {
	const { supabase } = await requireUser();
	// One round-trip: the buyer is embedded rather than fetched in a second call
	// that had to wait for the sale row just to learn its buyer_id.
	const { data: sale, error } = await supabase
		.from("sales").select("*,tenants(*)")
		.eq("property_id", propertyId).eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	if (!sale) return null;

	const { tenants, ...rest } = sale as Sale & { tenants: Tenant };
	return { ...rest, buyer: tenants };
}

export async function closeSale(id: string): Promise<Sale> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("sales")
		.update({ status: "closed" as SaleStatus })
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Sale;
}

/** Cancel an in-progress sale — caller is responsible for resetting the property status. */
export async function cancelSale(id: string): Promise<Sale> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("sales")
		.update({ status: "cancelled" as SaleStatus })
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Sale;
}

/** A sale plus the bits of its property needed to attribute the commission. */
export type SaleWithProperty = Sale & {
	property: { id: string; address_line: string; assigned_to: string | null } | null;
};

export interface SalesFilter {
	/** Inclusive ISO date bounds on sale_date. */
	from?: string;
	to?: string;
	status?: SaleStatus;
}

/**
 * Team-wide sales for commission reporting. RLS scopes the rows to the team;
 * the property join supplies `assigned_to` for the per-agent breakdown.
 */
export async function listSalesForTeam(filter: SalesFilter = {}): Promise<SaleWithProperty[]> {
	const { supabase } = await requireUser();
	let q = supabase
		.from("sales")
		.select("*, property:properties(id, address_line, assigned_to)")
		.order("sale_date", { ascending: false });
	if (filter.from) q = q.gte("sale_date", filter.from);
	if (filter.to) q = q.lte("sale_date", filter.to);
	if (filter.status) q = q.eq("status", filter.status);
	const { data, error } = await q;
	if (error) throw error;
	// PostgREST types a to-one join loosely; normalise the array form.
	return (data ?? []).map((row) => {
		const r = row as SaleWithProperty & { property: unknown };
		const p = Array.isArray(r.property) ? r.property[0] : r.property;
		return { ...r, property: (p ?? null) as SaleWithProperty["property"] };
	});
}

export async function listSalesForProperty(
	propertyId: string,
): Promise<(Sale & { buyer: Tenant | null })[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("sales").select("*, buyer:tenants(*)")
		.eq("property_id", propertyId)
		.order("sale_date", { ascending: false });
	if (error) throw error;
	return (data ?? []) as (Sale & { buyer: Tenant | null })[];
}
