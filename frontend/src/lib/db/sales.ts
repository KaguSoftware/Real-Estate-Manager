// Sales CRUD. Mirrors leases.ts. Owner-scoped via RLS.
// The partial unique index uniq_active_sale_per_property prevents two
// concurrent active sales on the same property — see migration 0003.

import { createClient } from "@/src/lib/supabase/client";
import type { Sale, SaleStatus, TaxResponsibility, Tenant } from "./types";

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

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function createSale(input: SaleInput): Promise<Sale> {
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("sales")
		.insert({
			...input,
			owner_id: user.id,
			currency: input.currency ?? "USD",
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
	const { data: sale, error } = await supabase
		.from("sales").select("*")
		.eq("property_id", propertyId).eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	if (!sale) return null;

	const s = sale as Sale;
	const { data: buyer, error: bErr } = await supabase
		.from("tenants").select("*").eq("id", s.buyer_id).single();
	if (bErr) throw bErr;
	return { ...s, buyer: buyer as Tenant };
}

export async function closeSale(id: string, _closeDate: string): Promise<Sale> {
	const { supabase } = await requireUser();
	// closeDate kept in the signature for future audit-log use; today we just flip status.
	const { data, error } = await supabase
		.from("sales")
		.update({ status: "closed" as SaleStatus })
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Sale;
}

export async function listSalesForProperty(propertyId: string): Promise<Sale[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("sales").select("*")
		.eq("property_id", propertyId)
		.order("sale_date", { ascending: false });
	if (error) throw error;
	return (data ?? []) as Sale[];
}
