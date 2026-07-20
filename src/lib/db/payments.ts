// Payment CRUD + balance aggregation.

import type { Payment, LeaseBalance } from "./types";
import { parseInput, paymentInputSchema } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

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
	const parsed = parseInput(paymentInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("payments")
		.insert({
			...parsed,
			team_id: requireTeamId(),
			created_by: user.id,
			amount_paid: parsed.amount_paid ?? parsed.amount_due,
			paid_at: parsed.paid_at ?? new Date().toISOString(),
		})
		.select()
		.single();
	if (error) throw error;
	return data as Payment;
}

export async function updatePayment(
	id: string,
	patch: Partial<Omit<PaymentInput, "lease_id">>,
): Promise<Payment> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("payments").update(patch).eq("id", id).select().single();
	if (error) throw error;
	return data as Payment;
}

export async function deletePayment(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("payments").delete().eq("id", id);
	if (error) throw error;
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
