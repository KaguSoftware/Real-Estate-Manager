// Tenant CRUD. RLS on public.tenants enforces owner-scoping.

import type { Tenant } from "./types";
import { orIlikeAnyColumn } from "./filterString";
import { parseInput, tenantInputSchema } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export interface TenantInput {
	full_name: string;
	email?: string | null;
	phone?: string | null;
	national_id?: string | null;
	notes?: string | null;
}


export async function createTenant(input: TenantInput): Promise<Tenant> {
	const parsed = parseInput(tenantInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("tenants")
		.insert({ ...parsed, team_id: requireTeamId(), created_by: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as Tenant;
}

export async function getTenant(id: string): Promise<Tenant> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("tenants").select("*").eq("id", id).single();
	if (error) throw error;
	return data as Tenant;
}

export async function updateTenant(
	id: string,
	patch: Partial<TenantInput>,
): Promise<Tenant> {
	const parsed = parseInput(tenantInputSchema.partial(), patch);
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("tenants").update(parsed).eq("id", id).select().single();
	if (error) throw error;
	return data as Tenant;
}

export async function deleteTenant(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("tenants").delete().eq("id", id);
	if (error) throw error;
}

export interface TenantFilter {
	q?: string;
}

export async function listTenants(filter: TenantFilter = {}): Promise<Tenant[]> {
	const { supabase } = await requireUser();
	let query = supabase
		.from("tenants").select("*")
		.order("updated_at", { ascending: false });
	const q = filter.q?.trim();
	if (q) {
		query = query.or(orIlikeAnyColumn(["full_name", "email", "phone"], q));
	}
	const { data, error } = await query;
	if (error) throw error;
	return (data ?? []) as Tenant[];
}

/**
 * How many leases (as tenant or guarantor) and sales (as buyer) reference this
 * person. Deleting a referenced tenant would CASCADE away those records and
 * their payment history — callers must block deletion when this is > 0.
 */
export async function countLinkedRecordsForTenant(id: string): Promise<number> {
	const { supabase } = await requireUser();
	const [leases, sales] = await Promise.all([
		supabase
			.from("leases")
			.select("id", { count: "exact", head: true })
			.or(`tenant_id.eq.${id},guarantor_id.eq.${id}`),
		supabase
			.from("sales")
			.select("id", { count: "exact", head: true })
			.eq("buyer_id", id),
	]);
	if (leases.error) throw leases.error;
	if (sales.error) throw sales.error;
	return (leases.count ?? 0) + (sales.count ?? 0);
}

/** Soft dedupe for the wizard — case-insensitive exact match. */
export async function findTenantByName(name: string): Promise<Tenant | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("tenants").select("*").ilike("full_name", name.trim()).maybeSingle();
	if (error) throw error;
	return (data as Tenant) ?? null;
}
