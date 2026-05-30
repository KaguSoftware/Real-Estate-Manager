"use client";

import { useEffect, useState } from "react";
import { listPaymentsForLease, recordPayment } from "@/src/lib/db/payments";
import type { Payment } from "@/src/lib/db/types";
import { Button, FormField, Input } from "@/src/components/ui";

interface Props {
	leaseId: string;
	currency: string;
	monthlyRent: number;
	/** Called after a payment is recorded so parent can refresh the balance. */
	onChanged?: () => void;
}

function fmt(n: number, ccy: string) {
	return `${n.toFixed(2)} ${ccy}`;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusOneMonth(start: string) {
	const d = new Date(start);
	d.setMonth(d.getMonth() + 1);
	return d.toISOString().slice(0, 10);
}

export function PaymentList({ leaseId, currency, monthlyRent, onChanged }: Props) {
	const [rows, setRows] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [showForm, setShowForm] = useState(false);
	const [periodStart, setPeriodStart] = useState(todayISO());
	const [periodEnd, setPeriodEnd] = useState(plusOneMonth(todayISO()));
	const [amount, setAmount] = useState(monthlyRent.toString());
	const [method, setMethod] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function reload() {
		setLoading(true);
		try {
			setRows(await listPaymentsForLease(leaseId));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally { setLoading(false); }
	}

	useEffect(() => { reload(); /* eslint-disable-next-line */ }, [leaseId]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await recordPayment({
				lease_id: leaseId,
				period_start: periodStart,
				period_end: periodEnd,
				amount_due: Number(amount),
				amount_paid: Number(amount),
				method: method.trim() || null,
			});
			setShowForm(false);
			setMethod("");
			await reload();
			onChanged?.();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally { setSubmitting(false); }
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-3">
				<p className="text-sm font-semibold text-slate-700">{rows.length} payment{rows.length === 1 ? "" : "s"}</p>
				<Button size="sm" variant={showForm ? "ghost" : "outline"} onClick={() => setShowForm((s) => !s)}>
					{showForm ? "Cancel" : "+ Record payment"}
				</Button>
			</div>

			{showForm && (
				<form onSubmit={handleSubmit} className="mb-4 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Period start">
							<Input
								type="date"
								value={periodStart}
								onChange={(e) => { setPeriodStart(e.target.value); setPeriodEnd(plusOneMonth(e.target.value)); }}
								required
							/>
						</FormField>
						<FormField label="Period end">
							<Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
						</FormField>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label={`Amount (${currency})`}>
							<Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
						</FormField>
						<FormField label="Method (optional)">
							<Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="cash, transfer, …" />
						</FormField>
					</div>
					<Button type="submit" block loading={submitting}>Save payment</Button>
				</form>
			)}

			{error && <p className="mb-2 text-sm text-red-600">{error}</p>}

			{loading ? (
				<p className="text-sm text-slate-400">Loading…</p>
			) : rows.length === 0 ? (
				<p className="text-sm text-slate-400 italic">No payments recorded yet.</p>
			) : (
				<ul className="divide-y divide-slate-100">
					{rows.map((p) => (
						<li key={p.id} className="py-3 flex justify-between gap-3 text-sm">
							<div className="min-w-0">
								<p className="text-slate-800 font-semibold">{fmt(Number(p.amount_paid), currency)}</p>
								<p className="text-xs text-slate-400 mt-0.5">
									{p.period_start} → {p.period_end}{p.method ? ` · ${p.method}` : ""}
								</p>
							</div>
							<p className="text-xs text-slate-400 whitespace-nowrap">
								{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
