"use client";

import { useCallback, useEffect, useState } from "react";
import {
	deletePayment,
	listPaymentsForLease,
	recordPayment,
	updatePayment,
} from "@/src/lib/db/payments";
import { invalidateCache } from "@/src/lib/useCachedResource";
import type { Payment } from "@/src/lib/db/types";
import {
	Button, FormField, Input, Alert, Spinner, ConfirmDialog, EmptyState, toast,
} from "@/src/components/ui";
import { positiveNumber, compactErrors } from "@/src/lib/validation";
import { Pencil, Trash2, Receipt } from "lucide-react";

interface Props {
	leaseId: string;
	currency: string;
	monthlyRent: number;
	/** Called after a payment changes so parent can refresh the balance. */
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

type FormMode = { mode: "create" } | { mode: "edit"; payment: Payment };

export function PaymentList({ leaseId, currency, monthlyRent, onChanged }: Props) {
	const [rows, setRows] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [form, setForm] = useState<FormMode | null>(null);
	const [periodStart, setPeriodStart] = useState(todayISO());
	const [periodEnd, setPeriodEnd] = useState(plusOneMonth(todayISO()));
	const [amount, setAmount] = useState(monthlyRent.toString());
	const [method, setMethod] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const [deleting, setDeleting] = useState<Payment | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			setRows(await listPaymentsForLease(leaseId));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally { setLoading(false); }
	}, [leaseId]);

	useEffect(() => { reload(); }, [reload]);

	function openCreate() {
		setForm({ mode: "create" });
		setPeriodStart(todayISO());
		setPeriodEnd(plusOneMonth(todayISO()));
		setAmount(monthlyRent.toString());
		setMethod("");
		setFieldErrors({});
	}

	function openEdit(p: Payment) {
		setForm({ mode: "edit", payment: p });
		setPeriodStart(p.period_start);
		setPeriodEnd(p.period_end);
		setAmount(String(p.amount_paid));
		setMethod(p.method ?? "");
		setFieldErrors({});
	}

	function validate(): boolean {
		const errors = compactErrors({
			amount: positiveNumber(amount, "Amount"),
			periodEnd:
				periodStart && periodEnd && Date.parse(periodEnd) <= Date.parse(periodStart)
					? "Period end must be after the start."
					: undefined,
		});
		setFieldErrors(errors);
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!form || !validate()) return;
		setSubmitting(true);
		try {
			if (form.mode === "create") {
				await recordPayment({
					lease_id: leaseId,
					period_start: periodStart,
					period_end: periodEnd,
					amount_due: Number(amount),
					amount_paid: Number(amount),
					method: method.trim() || null,
				});
				toast.success("Payment recorded.");
			} else {
				await updatePayment(form.payment.id, {
					period_start: periodStart,
					period_end: periodEnd,
					amount_due: Number(amount),
					amount_paid: Number(amount),
					method: method.trim() || null,
				});
				toast.success("Payment updated.");
			}
			invalidateCache("stats");
			setForm(null);
			await reload();
			onChanged?.();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally { setSubmitting(false); }
	}

	async function handleDelete() {
		if (!deleting) return;
		setDeleteBusy(true);
		setError(null);
		try {
			await deletePayment(deleting.id);
			invalidateCache("stats");
			toast.success("Payment deleted.");
			setDeleting(null);
			await reload();
			onChanged?.();
		} catch (e) {
			setDeleting(null);
			setError(e instanceof Error ? e.message : String(e));
		} finally { setDeleteBusy(false); }
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-3">
				<p className="text-sm font-semibold text-slate-700">{rows.length} payment{rows.length === 1 ? "" : "s"}</p>
				<Button size="sm" variant={form ? "ghost" : "outline"} onClick={() => (form ? setForm(null) : openCreate())}>
					{form ? "Cancel" : "+ Record payment"}
				</Button>
			</div>

			{form && (
				<form onSubmit={handleSubmit} className="mb-4 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
					{form.mode === "edit" && (
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Editing payment</p>
					)}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Period start">
							<Input
								type="date"
								value={periodStart}
								onChange={(e) => { setPeriodStart(e.target.value); setPeriodEnd(plusOneMonth(e.target.value)); }}
								required
							/>
						</FormField>
						<FormField label="Period end" error={fieldErrors.periodEnd}>
							<Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
						</FormField>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label={`Amount (${currency})`} error={fieldErrors.amount}>
							<Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
						</FormField>
						<FormField label="Method (optional)">
							<Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="cash, transfer, …" />
						</FormField>
					</div>
					{error && <Alert>{error}</Alert>}
					<Button type="submit" block loading={submitting}>
						{form.mode === "create" ? "Save payment" : "Save changes"}
					</Button>
				</form>
			)}

			{!form && error && <Alert className="mb-3">{error}</Alert>}

			{loading ? (
				<div className="py-6 flex justify-center"><Spinner /></div>
			) : rows.length === 0 ? (
				<EmptyState
					icon={Receipt}
					title="No payments recorded yet"
					hint="Record the first rent payment to start tracking the balance."
					className="py-6"
				/>
			) : (
				<ul className="divide-y divide-slate-100">
					{rows.map((p) => (
						<li key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
							<div className="min-w-0">
								<p className="text-slate-800 font-semibold">{fmt(Number(p.amount_paid), currency)}</p>
								<p className="text-xs text-slate-400 mt-0.5">
									{p.period_start} → {p.period_end}{p.method ? ` · ${p.method}` : ""}
								</p>
							</div>
							<div className="flex items-center gap-1 shrink-0">
								<p className="text-xs text-slate-400 whitespace-nowrap mr-2">
									{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
								</p>
								<button
									type="button"
									onClick={() => openEdit(p)}
									aria-label="Edit payment"
									className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
								>
									<Pencil className="w-4 h-4" />
								</button>
								<button
									type="button"
									onClick={() => setDeleting(p)}
									aria-label="Delete payment"
									className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<ConfirmDialog
				open={deleting !== null}
				title="Delete this payment?"
				message={
					deleting
						? `${fmt(Number(deleting.amount_paid), currency)} for ${deleting.period_start} → ${deleting.period_end}. This cannot be undone.`
						: undefined
				}
				confirmLabel="Delete"
				loading={deleteBusy}
				onConfirm={handleDelete}
				onCancel={() => setDeleting(null)}
			/>
		</div>
	);
}
