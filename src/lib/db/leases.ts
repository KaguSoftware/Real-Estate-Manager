// Lease CRUD. The partial unique index uniq_active_lease_per_property
// DB-enforces "at most one active lease per property" — see migration 0006.

import { createClient } from "@/src/lib/supabase/client";
import type { InventoryItem, Lease, LeaseTerm, Tenant, UtilityResponsibility } from "./types";
import { leaseInputSchema, parseInput } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";

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
	// Turkish kira-sözleşmesi fields (migration 0007). All optional — the DB
	// supplies defaults for the utility/subletting/inventory columns.
	guarantor_id?: string | null;
	payment_day?: number | null;
	payment_method?: string | null;
	bank_account?: string | null;
	util_electricity?: UtilityResponsibility;
	util_water?: UtilityResponsibility;
	util_gas?: UtilityResponsibility;
	util_internet?: UtilityResponsibility;
	util_aidat?: UtilityResponsibility;
	subletting_allowed?: boolean;
	rent_increase_note?: string | null;
	inventory?: InventoryItem[];
	condition_notes?: string | null;
	special_conditions?: string | null;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function createLease(input: LeaseInput): Promise<Lease> {
	const parsed = parseInput(leaseInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("leases")
		.insert({
			...parsed,
			team_id: requireTeamId(),
			created_by: user.id,
			deposit: parsed.deposit ?? 0,
			currency: parsed.currency ?? "TRY",
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

/** Fields an existing lease can safely change without touching its identity. */
export type LeaseUpdate = Partial<
	Pick<
		LeaseInput,
		| "monthly_rent"
		| "deposit"
		| "currency"
		| "start_date"
		| "end_date"
		| "term"
		| "payment_day"
		| "payment_method"
		| "bank_account"
		| "rent_increase_note"
		| "special_conditions"
	>
>;

export async function updateLease(id: string, patch: LeaseUpdate): Promise<Lease> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leases")
		.update(patch)
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Lease;
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

export async function listLeasesForProperty(
	propertyId: string,
): Promise<(Lease & { tenant: Tenant | null })[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leases").select("*, tenant:tenants!leases_tenant_id_fkey(*)")
		.eq("property_id", propertyId)
		.order("start_date", { ascending: false });
	if (error) throw error;
	return (data ?? []) as (Lease & { tenant: Tenant | null })[];
}

/**
 * Renew a lease: end the old one the day the new one starts, then create the
 * replacement (same property/tenant unless overridden). Sequential because the
 * partial unique index allows only one active lease per property — the old
 * lease must be ended before the new insert. Not atomic: if the create fails
 * the old lease stays ended, which is surfaced to the caller as an error so
 * the user can retry the new lease from the documents wizard.
 */
export async function renewLease(
	oldLease: Lease,
	overrides: Partial<LeaseInput> & { start_date: string },
): Promise<Lease> {
	await endLease(oldLease.id, overrides.start_date);
	const input: LeaseInput = {
		property_id: oldLease.property_id,
		tenant_id: oldLease.tenant_id,
		term: oldLease.term,
		monthly_rent: Number(oldLease.monthly_rent),
		deposit: Number(oldLease.deposit),
		currency: oldLease.currency,
		guarantor_id: oldLease.guarantor_id,
		payment_day: oldLease.payment_day,
		payment_method: oldLease.payment_method,
		bank_account: oldLease.bank_account,
		util_electricity: oldLease.util_electricity,
		util_water: oldLease.util_water,
		util_gas: oldLease.util_gas,
		util_internet: oldLease.util_internet,
		util_aidat: oldLease.util_aidat,
		subletting_allowed: oldLease.subletting_allowed,
		rent_increase_note: oldLease.rent_increase_note,
		inventory: oldLease.inventory,
		condition_notes: oldLease.condition_notes,
		special_conditions: oldLease.special_conditions,
		...overrides,
		end_date:
			overrides.end_date !== undefined
				? overrides.end_date
				: computeLeaseEndDate(overrides.start_date, overrides.term ?? oldLease.term),
	};
	return createLease(input);
}

/** Compute an end_date when term is fixed; null for undefined. */
export function computeLeaseEndDate(start: string, term: LeaseTerm): string | null {
	if (term === "undefined") return null;
	const d = new Date(start);
	const years = term === "1yr" ? 1 : 2;
	d.setFullYear(d.getFullYear() + years);
	return d.toISOString().slice(0, 10);
}
