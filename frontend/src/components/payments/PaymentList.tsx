"use client";

import { useEffect, useState } from "react";
import { listPaymentsForLease, recordPayment } from "@/src/lib/db/payments";
import type { Payment } from "@/src/lib/db/types";

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
		<div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
			<div className="flex items-center justify-between mb-3">
				<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
					Payments ({rows.length})
				</h4>
				<button
					type="button"
					onClick={() => setShowForm((s) => !s)}
					className="text-[10px] font-semibold text-primary hover:underline"
				>
					{showForm ? "Cancel" : "+ Record payment"}
				</button>
			</div>

			{showForm && (
				<form onSubmit={handleSubmit} className="mb-4 space-y-2 p-3 bg-white rounded-lg border border-slate-200">
					<div className="grid grid-cols-2 gap-2">
						<label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
							Period start
							<input
								type="date"
								value={periodStart}
								onChange={(e) => { setPeriodStart(e.target.value); setPeriodEnd(plusOneMonth(e.target.value)); }}
								className="mt-1 w-full px-2 py-1 text-xs border border-slate-200 rounded"
								required
							/>
						</label>
						<label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
							Period end
							<input
								type="date"
								value={periodEnd}
								onChange={(e) => setPeriodEnd(e.target.value)}
								className="mt-1 w-full px-2 py-1 text-xs border border-slate-200 rounded"
								required
							/>
						</label>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
							Amount ({currency})
							<input
								type="number"
								min="0"
								step="0.01"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								className="mt-1 w-full px-2 py-1 text-xs border border-slate-200 rounded"
								required
							/>
						</label>
						<label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
							Method (optional)
							<input
								value={method}
								onChange={(e) => setMethod(e.target.value)}
								className="mt-1 w-full px-2 py-1 text-xs border border-slate-200 rounded"
								placeholder="cash, transfer, …"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={submitting}
						className="w-full mt-1 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-content hover:opacity-90 disabled:opacity-50"
					>
						{submitting ? "Saving…" : "Save payment"}
					</button>
				</form>
			)}

			{error && <p className="mb-2 text-[10px] text-red-600">{error}</p>}

			{loading ? (
				<p className="text-[11px] text-slate-400">Loading…</p>
			) : rows.length === 0 ? (
				<p className="text-[11px] text-slate-400 italic">No payments recorded yet.</p>
			) : (
				<ul className="divide-y divide-slate-200">
					{rows.map((p) => (
						<li key={p.id} className="py-2 flex justify-between text-xs">
							<div>
								<p className="text-slate-700 font-medium">{fmt(Number(p.amount_paid), currency)}</p>
								<p className="text-[10px] text-slate-400">
									{p.period_start} → {p.period_end}{p.method ? ` · ${p.method}` : ""}
								</p>
							</div>
							<p className="text-[10px] text-slate-400">
								{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
