// "Needs attention" feed for the dashboard: overdue rent, rent due soon,
// leases expiring soon, and leads that have gone quiet. Same philosophy as
// stats.ts — a few cheap selects reduced in JS; cached under "attention" via
// useCachedResource and invalidated alongside "stats".
//
// Classification logic lives in attentionLogic.ts (pure, unit-tested);
// thresholds default to DEFAULT_ATTENTION_THRESHOLDS and can be overridden
// per user via profiles.settings (see settings.ts).

import { createClient } from "@/src/lib/supabase/client";
import {
	DEFAULT_ATTENTION_THRESHOLDS,
	classifyLeads,
	classifyLeases,
	classifyPayments,
	type AttentionLead,
	type AttentionLeaseEnd,
	type AttentionPayment,
	type AttentionThresholds,
	type LeadRow,
	type LeaseEndRow,
	type PaymentRow,
} from "./attentionLogic";

export type { AttentionLead, AttentionLeaseEnd, AttentionPayment, AttentionThresholds };

export interface AttentionData {
	overduePayments: AttentionPayment[];
	upcomingPayments: AttentionPayment[];
	endingLeases: AttentionLeaseEnd[];
	staleLeads: AttentionLead[];
	total: number;
}

export async function getAttentionData(
	thresholds: AttentionThresholds = DEFAULT_ATTENTION_THRESHOLDS,
): Promise<AttentionData> {
	const supabase = createClient();
	const { data: { user }, error: authErr } = await supabase.auth.getUser();
	if (authErr || !user) throw new Error("Not authenticated");

	const now = new Date();
	const todayISO = now.toISOString().slice(0, 10);
	const soon = new Date(now.getTime() + thresholds.upcomingDays * 86_400_000)
		.toISOString().slice(0, 10);
	const leaseHorizon = new Date(now.getTime() + thresholds.leaseWarnDays * 86_400_000)
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

	const { overduePayments, upcomingPayments } = classifyPayments(
		(payRes.data ?? []) as unknown as PaymentRow[],
		todayISO,
	);
	const endingLeases = classifyLeases(
		(leaseRes.data ?? []) as unknown as LeaseEndRow[],
		now,
	);
	const staleLeads = classifyLeads(
		(leadRes.data ?? []) as LeadRow[],
		now,
		thresholds.leadSilentDays,
	);

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
