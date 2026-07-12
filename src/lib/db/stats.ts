// Dashboard KPI aggregation. Computed server-side by the get_dashboard_stats()
// SQL function (supabase/migrations/0023_dashboard_stats.sql) — one RPC round
// trip instead of four full-table selects reduced in JS. Cached under the
// "stats" key via useCachedResource; mutations that affect these numbers call
// invalidateCache("stats").

import { createClient } from "@/src/lib/supabase/client";
import type { LeadStatus, PropertyStatus } from "./types";

/** One row of the "Portföy sağlığı" panel (rentals only, worst-first, ≤50). */
export interface PropertyHealthRow {
	id: string;
	address_line: string;
	status: PropertyStatus;
	/** Active lease's end date (ISO date) or null when vacant / open-ended. */
	lease_end_date: string | null;
	/** Overdue payments (period ended, not fully paid) for this property. */
	overdue_count: number;
}

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
	// ── extended (portfolio-health) fields ────────────────────────────────────
	/** Property counts by listing type. */
	propertiesByListingType: { for_rent: number; for_sale: number };
	/** Number of active leases. */
	activeLeases: number;
	/** Active leases whose end_date falls within the next 90 days. */
	leasesExpiringSoon: number;
	/** Overdue payments: period ended, amount_paid < amount_due (any lease). */
	overdue: { count: number; totalByCurrency: Record<string, number> };
	/** Leads never called (last_call_at is null). */
	leadsWithNoActivity: number;
	/** Per-rental health rows, worst offenders first (max 50). */
	propertyHealth: PropertyHealthRow[];
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function getDashboardStats(): Promise<DashboardStats> {
	const { supabase } = await requireUser();

	const { data, error } = await supabase.rpc("get_dashboard_stats");
	if (error) throw error;
	if (!data) throw new Error("Empty dashboard stats response");

	// The SQL function builds this exact JSONB shape; cast at the boundary.
	return data as DashboardStats;
}
