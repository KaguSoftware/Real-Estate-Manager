// "Needs attention" feed for the dashboard: overdue rent, rent due soon,
// leases expiring soon, and leads that have gone quiet. Same philosophy as
// stats.ts — a few cheap selects reduced in JS; cached under "attention" via
// useCachedResource and invalidated alongside "stats".

import { createClient } from "@/src/lib/supabase/client";
import type { LeadStatus } from "./types";

export interface AttentionPayment {
	paymentId: string;
	propertyId: string;
	propertyLabel: string;
	periodStart: string;
	periodEnd: string;
	outstanding: number;
	currency: string;
}

export interface AttentionLeaseEnd {
	leaseId: string;
	propertyId: string;
	propertyLabel: string;
	endDate: string;
	daysLeft: number;
}

export interface AttentionLead {
	leadId: string;
	name: string;
	status: LeadStatus;
	lastCallAt: string | null;
	daysSilent: number;
}

export interface AttentionData {
	overduePayments: AttentionPayment[];
	upcomingPayments: AttentionPayment[];
	endingLeases: AttentionLeaseEnd[];
	staleLeads: AttentionLead[];
	total: number;
}

const UPCOMING_DAYS = 7;
const LEASE_WARN_DAYS = 30;
const LEAD_SILENT_DAYS = 14;

interface PaymentRow {
	id: string;
	period_start: string;
	period_end: string;
	amount_due: number;
	amount_paid: number;
	lease: {
		id: string;
		status: string;
		currency: string;
		property_id: string;
		property: { id: string; address_line: string; homeowner_name: string } | null;
	} | null;
}

function propertyLabel(p: { address_line: string; homeowner_name: string } | null): string {
	if (!p) return "Unknown property";
	return p.address_line || p.homeowner_name || "Unknown property";
}

function daysBetween(fromISO: string, to: Date): number {
	return Math.round((to.getTime() - new Date(fromISO).getTime()) / 86_400_000);
}

export async function getAttentionData(): Promise<AttentionData> {
	const supabase = createClient();
	const { data: { user }, error: authErr } = await supabase.auth.getUser();
	if (authErr || !user) throw new Error("Not authenticated");

	const now = new Date();
	const todayISO = now.toISOString().slice(0, 10);
	const soon = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000).toISOString().slice(0, 10);
	const leaseHorizon = new Date(now.getTime() + LEASE_WARN_DAYS * 86_400_000)
		.toISOString().slice(0, 10);

	const [payRes, leaseRes, leadRes] = await Promise.all([
		supabase
			.from("payments")
			.select(
				"id, period_start, period_end, amount_due, amount_paid, " +
				"lease:leases(id, status, currency, property_id, " +
				"property:properties(id, address_line, homeowner_name))",
			)
			.lte("period_end", soon),
		supabase
			.from("leases")
			.select("id, end_date, property_id, property:properties(id, address_line, homeowner_name)")
			.eq("status", "active")
			.gte("end_date", todayISO)
			.lte("end_date", leaseHorizon),
		supabase
			.from("leads")
			.select("id, full_name, status, last_call_at, created_at")
			.in("status", ["new", "follow_up", "interested"]),
	]);
	if (payRes.error) throw payRes.error;
	if (leaseRes.error) throw leaseRes.error;
	if (leadRes.error) throw leadRes.error;

	const overduePayments: AttentionPayment[] = [];
	const upcomingPayments: AttentionPayment[] = [];
	for (const row of (payRes.data ?? []) as unknown as PaymentRow[]) {
		const outstanding = Number(row.amount_due ?? 0) - Number(row.amount_paid ?? 0);
		if (outstanding <= 0) continue;
		if (!row.lease || row.lease.status !== "active") continue;
		const entry: AttentionPayment = {
			paymentId: row.id,
			propertyId: row.lease.property_id,
			propertyLabel: propertyLabel(row.lease.property),
			periodStart: row.period_start,
			periodEnd: row.period_end,
			outstanding,
			currency: row.lease.currency || "TRY",
		};
		(row.period_end < todayISO ? overduePayments : upcomingPayments).push(entry);
	}
	overduePayments.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
	upcomingPayments.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

	const endingLeases: AttentionLeaseEnd[] = (
		(leaseRes.data ?? []) as unknown as {
			id: string;
			end_date: string;
			property_id: string;
			property: { id: string; address_line: string; homeowner_name: string } | null;
		}[]
	)
		.map((l) => ({
			leaseId: l.id,
			propertyId: l.property_id,
			propertyLabel: propertyLabel(l.property),
			endDate: l.end_date,
			daysLeft: -daysBetween(l.end_date, now),
		}))
		.sort((a, b) => a.endDate.localeCompare(b.endDate));

	const staleLeads: AttentionLead[] = (
		(leadRes.data ?? []) as {
			id: string;
			full_name: string;
			status: LeadStatus;
			last_call_at: string | null;
			created_at: string;
		}[]
	)
		.map((l) => ({
			leadId: l.id,
			name: l.full_name,
			status: l.status,
			lastCallAt: l.last_call_at,
			daysSilent: daysBetween(l.last_call_at ?? l.created_at, now),
		}))
		.filter((l) => l.daysSilent >= LEAD_SILENT_DAYS)
		.sort((a, b) => b.daysSilent - a.daysSilent);

	return {
		overduePayments,
		upcomingPayments,
		endingLeases,
		staleLeads,
		total:
			overduePayments.length + upcomingPayments.length +
			endingLeases.length + staleLeads.length,
	};
}
