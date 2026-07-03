// Dashboard KPI aggregation. Computed from four cheap column-only selects and
// reduced in JS — row counts for a single-agent CRM are small, so no SQL
// function is warranted. Cached under the "stats" key via useCachedResource;
// mutations that affect these numbers call invalidateCache("stats").

import { createClient } from "@/src/lib/supabase/client";
import type { LeadStatus, PropertyStatus } from "./types";

export interface DashboardStats {
	properties: Record<PropertyStatus, number>;
	/** Sum of active leases' monthly rent, keyed by currency. */
	monthlyRentByCurrency: Record<string, number>;
	/** Outstanding balance (due − paid) across active leases, keyed by currency. */
	outstandingByCurrency: Record<string, number>;
	leadsByStatus: Record<LeadStatus, number>;
	totalLeads: number;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function getDashboardStats(): Promise<DashboardStats> {
	const { supabase } = await requireUser();

	const [propsRes, leasesRes, leadsRes] = await Promise.all([
		supabase.from("properties").select("status"),
		supabase.from("leases").select("id, monthly_rent, currency").eq("status", "active"),
		supabase.from("leads").select("status"),
	]);
	if (propsRes.error) throw propsRes.error;
	if (leasesRes.error) throw leasesRes.error;
	if (leadsRes.error) throw leadsRes.error;

	const properties: Record<PropertyStatus, number> = { vacant: 0, occupied: 0, sold: 0 };
	for (const row of (propsRes.data ?? []) as { status: PropertyStatus }[]) {
		if (row.status in properties) properties[row.status]++;
	}

	const activeLeases = (leasesRes.data ?? []) as {
		id: string;
		monthly_rent: number;
		currency: string;
	}[];
	const monthlyRentByCurrency: Record<string, number> = {};
	const currencyByLease = new Map<string, string>();
	for (const l of activeLeases) {
		const cur = l.currency || "TRY";
		monthlyRentByCurrency[cur] = (monthlyRentByCurrency[cur] ?? 0) + Number(l.monthly_rent ?? 0);
		currencyByLease.set(l.id, cur);
	}

	const outstandingByCurrency: Record<string, number> = {};
	if (activeLeases.length > 0) {
		const payRes = await supabase
			.from("payments")
			.select("lease_id, amount_due, amount_paid")
			.in("lease_id", activeLeases.map((l) => l.id));
		if (payRes.error) throw payRes.error;
		for (const p of (payRes.data ?? []) as {
			lease_id: string;
			amount_due: number;
			amount_paid: number;
		}[]) {
			const cur = currencyByLease.get(p.lease_id) ?? "TRY";
			const delta = Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0);
			outstandingByCurrency[cur] = (outstandingByCurrency[cur] ?? 0) + delta;
		}
		// Fully-settled currencies aren't interesting — keep only positive balances.
		for (const cur of Object.keys(outstandingByCurrency)) {
			if (outstandingByCurrency[cur] <= 0) delete outstandingByCurrency[cur];
		}
	}

	const leadsByStatus: Record<LeadStatus, number> = {
		new: 0, called_rejected: 0, follow_up: 0, interested: 0, closed: 0,
	};
	let totalLeads = 0;
	for (const row of (leadsRes.data ?? []) as { status: LeadStatus }[]) {
		if (row.status in leadsByStatus) leadsByStatus[row.status]++;
		totalLeads++;
	}

	return { properties, monthlyRentByCurrency, outstandingByCurrency, leadsByStatus, totalLeads };
}
