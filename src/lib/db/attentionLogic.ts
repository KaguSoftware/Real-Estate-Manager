// Pure classification logic behind the "needs attention" feed. Extracted from
// attention.ts so it can be unit-tested and driven by user-configurable
// thresholds (profiles.settings) without touching the Supabase queries.

import type { LeadStatus } from "./types";

export interface AttentionThresholds {
	/** Rent due within this many days counts as "upcoming". */
	upcomingDays: number;
	/** Active leases ending within this many days are surfaced. */
	leaseWarnDays: number;
	/** Leads not contacted for this many days count as "gone quiet". */
	leadSilentDays: number;
}

export const DEFAULT_ATTENTION_THRESHOLDS: AttentionThresholds = {
	upcomingDays: 7,
	leaseWarnDays: 30,
	leadSilentDays: 14,
};

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

export interface PaymentRow {
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

export interface LeaseEndRow {
	id: string;
	end_date: string;
	property_id: string;
	property: { id: string; address_line: string; homeowner_name: string } | null;
}

export interface LeadRow {
	id: string;
	full_name: string;
	status: LeadStatus;
	last_call_at: string | null;
	created_at: string;
}

export function propertyLabel(
	p: { address_line: string; homeowner_name: string } | null,
): string {
	if (!p) return "Bilinmeyen taşınmaz";
	return p.address_line || p.homeowner_name || "Bilinmeyen taşınmaz";
}

export function daysBetween(fromISO: string, to: Date): number {
	return Math.round((to.getTime() - new Date(fromISO).getTime()) / 86_400_000);
}

/** Split unpaid payment rows into overdue vs upcoming relative to `todayISO`. */
export function classifyPayments(
	rows: PaymentRow[],
	todayISO: string,
): { overduePayments: AttentionPayment[]; upcomingPayments: AttentionPayment[] } {
	const overduePayments: AttentionPayment[] = [];
	const upcomingPayments: AttentionPayment[] = [];
	for (const row of rows) {
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
	return { overduePayments, upcomingPayments };
}

export function classifyLeases(rows: LeaseEndRow[], now: Date): AttentionLeaseEnd[] {
	return rows
		.map((l) => ({
			leaseId: l.id,
			propertyId: l.property_id,
			propertyLabel: propertyLabel(l.property),
			endDate: l.end_date,
			daysLeft: -daysBetween(l.end_date, now),
		}))
		.sort((a, b) => a.endDate.localeCompare(b.endDate));
}

export function classifyLeads(
	rows: LeadRow[],
	now: Date,
	leadSilentDays: number,
): AttentionLead[] {
	return rows
		.map((l) => ({
			leadId: l.id,
			name: l.full_name,
			status: l.status,
			lastCallAt: l.last_call_at,
			daysSilent: daysBetween(l.last_call_at ?? l.created_at, now),
		}))
		.filter((l) => l.daysSilent >= leadSilentDays)
		.sort((a, b) => b.daysSilent - a.daysSilent);
}
