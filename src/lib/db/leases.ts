// Lease CRUD. The partial unique index uniq_active_lease_per_property
// DB-enforces "at most one active lease per property" — see migration 0006.

import { createClient } from "@/src/lib/supabase/client";
import type { Lease, LeaseTerm, Tenant } from "./types";

export interface LeaseInput {
	property_id: string;
	tenant_id: string;
	term: LeaseTerm;
	start_date: string;          // ISO date
	end_date?: string | null;    // computed by caller when term !== 'undefined'
	monthly_rent: number;
	deposit?: number;
	currency?: string;
	document_pdf_path?: string | null;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function createLease(input: LeaseInput): Promise<Lease> {
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("leases")
		.insert({
			...input,
			owner_id: user.id,
			deposit: input.deposit ?? 0,
			currency: input.currency ?? "TRY",
		})
		.select()
		.single();
	if (error) throw error;
	return data as Lease;
}

export async function getActiveLeaseForProperty(
	propertyId: string,
): Promise<(Lease & { tenant: Tenant }) | null> {
	const { supabase } = await requireUser();
	const { data: lease, error } = await supabase
		.from("leases").select("*")
		.eq("property_id", propertyId).eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	if (!lease) return null;

	const l = lease as Lease;
	const { data: tenant, error: tErr } = await supabase
		.from("tenants").select("*").eq("id", l.tenant_id).single();
	if (tErr) throw tErr;
	return { ...l, tenant: tenant as Tenant };
}

export async function endLease(id: string, endDate: string): Promise<Lease> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leases")
		.update({ status: "ended", end_date: endDate })
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Lease;
}

export async function listLeasesForProperty(propertyId: string): Promise<Lease[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leases").select("*")
		.eq("property_id", propertyId)
		.order("start_date", { ascending: false });
	if (error) throw error;
	return (data ?? []) as Lease[];
}

/** Compute an end_date when term is fixed; null for undefined. */
export function computeLeaseEndDate(start: string, term: LeaseTerm): string | null {
	if (term === "undefined") return null;
	const d = new Date(start);
	const years = term === "1yr" ? 1 : 2;
	d.setFullYear(d.getFullYear() + years);
	return d.toISOString().slice(0, 10);
}
