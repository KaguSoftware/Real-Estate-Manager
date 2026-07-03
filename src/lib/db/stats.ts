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
	/** occupied / (occupied + vacant), 0..1; null when no rentable properties. */
	occupancyRate: number | null;
	/** Current calendar month's rent collection, keyed by currency. */
	collectionThisMonth: Record<string, { due: number; paid: number }>;
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
	const collectionThisMonth: Record<string, { due: number; paid: number }> = {};
	if (activeLeases.length > 0) {
		const now = new Date();
		const monthStart = `${now.toISOString().slice(0, 7)}-01`;
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

		const payRes = await supabase
			.from("payments")
			.select("lease_id, amount_due, amount_paid, period_start")
			.in("lease_id", activeLeases.map((l) => l.id));
		if (payRes.error) throw payRes.error;
		for (const p of (payRes.data ?? []) as {
			lease_id: string;
			amount_due: number;
			amount_paid: number;
			period_start: string;
		}[]) {
			const cur = currencyByLease.get(p.lease_id) ?? "TRY";
			const due = Number(p.amount_due ?? 0);
			const paid = Number(p.amount_paid ?? 0);
			outstandingByCurrency[cur] = (outstandingByCurrency[cur] ?? 0) + (due - paid);
			if (p.period_start >= monthStart && p.period_start < monthEnd) {
				const bucket = (collectionThisMonth[cur] ??= { due: 0, paid: 0 });
				bucket.due += due;
				bucket.paid += paid;
			}
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

	const rentable = properties.occupied + properties.vacant;
	const occupancyRate = rentable > 0 ? properties.occupied / rentable : null;

	return {
		properties,
		monthlyRentByCurrency,
		outstandingByCurrency,
		leadsByStatus,
		totalLeads,
		occupancyRate,
		collectionThisMonth,
	};
}
