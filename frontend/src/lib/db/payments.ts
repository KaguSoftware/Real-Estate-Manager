// Payment CRUD + balance aggregation.

import { createClient } from "@/src/lib/supabase/client";
import type { Payment, LeaseBalance } from "./types";

export interface PaymentInput {
	lease_id: string;
	period_start: string;
	period_end: string;
	amount_due: number;
	amount_paid?: number;
	paid_at?: string | null;
	method?: string | null;
	notes?: string | null;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function listPaymentsForLease(leaseId: string): Promise<Payment[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("payments").select("*")
		.eq("lease_id", leaseId)
		.order("period_start", { ascending: false });
	if (error) throw error;
	return (data ?? []) as Payment[];
}

export async function recordPayment(input: PaymentInput): Promise<Payment> {
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("payments")
		.insert({
			...input,
			owner_id: user.id,
			amount_paid: input.amount_paid ?? input.amount_due,
			paid_at: input.paid_at ?? new Date().toISOString(),
		})
		.select()
		.single();
	if (error) throw error;
	return data as Payment;
}

export async function getLeaseBalance(leaseId: string): Promise<LeaseBalance> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("payments")
		.select("amount_due, amount_paid")
		.eq("lease_id", leaseId);
	if (error) throw error;

	const rows = (data ?? []) as { amount_due: number; amount_paid: number }[];
	const totalDue  = rows.reduce((s, r) => s + Number(r.amount_due  ?? 0), 0);
	const totalPaid = rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
	return { totalDue, totalPaid, balance: totalDue - totalPaid };
}
