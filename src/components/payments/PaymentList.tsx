"use client";

import { humanizeError } from "@/src/lib/errors";
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
import { downloadCsv } from "@/src/lib/csv";
import { Pencil, Trash2, Receipt, Download } from "lucide-react";

interface Props {
	leaseId: string;
	currency: string;
	monthlyRent: number;
	/** Called after a payment changes so parent can refresh the balance. */
	onChanged?: () => void;
	/** When provided, each row shows a "download receipt" action. */
	onReceipt?: (payment: Payment) => void;
}

import { fmtMoney as fmt } from "@/src/lib/format";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusOneMonth(start: string) {
	const d = new Date(start);
	d.setMonth(d.getMonth() + 1);
	return d.toISOString().slice(0, 10);
}

type FormMode = { mode: "create" } | { mode: "edit"; payment: Payment };

export function PaymentList({ leaseId, currency, monthlyRent, onChanged, onReceipt }: Props) {
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
			setError(humanizeError(e));
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
			amount: positiveNumber(amount, "Tutar"),
			periodEnd:
				periodStart && periodEnd && Date.parse(periodEnd) <= Date.parse(periodStart)
					? "Dönem bitişi başlangıçtan sonra olmalıdır."
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
				toast.success("Ödeme kaydedildi.");
			} else {
				await updatePayment(form.payment.id, {
					period_start: periodStart,
					period_end: periodEnd,
					amount_due: Number(amount),
					amount_paid: Number(amount),
					method: method.trim() || null,
				});
				toast.success("Ödeme güncellendi.");
			}
			invalidateCache("stats");
			invalidateCache("attention");
			setForm(null);
			await reload();
			onChanged?.();
		} catch (e) {
			setError(humanizeError(e));
		} finally { setSubmitting(false); }
	}

	async function handleDelete() {
		if (!deleting) return;
		setDeleteBusy(true);
		setError(null);
		try {
			await deletePayment(deleting.id);
			invalidateCache("stats");
			invalidateCache("attention");
			toast.success("Ödeme silindi.");
			setDeleting(null);
			await reload();
			onChanged?.();
		} catch (e) {
			setDeleting(null);
			setError(humanizeError(e));
		} finally { setDeleteBusy(false); }
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-3">
				<p className="text-sm font-semibold text-base-content/80">{rows.length} ödeme</p>
				<div className="flex items-center gap-1">
					{rows.length > 0 && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() =>
								downloadCsv(
									"payments",
									["Dönem başlangıcı", "Dönem bitişi", "Vadesi gelen tutar", "Ödenen tutar", "Para birimi", "Yöntem", "Ödeme tarihi", "Notlar"],
									rows.map((p) => [
										p.period_start, p.period_end, p.amount_due, p.amount_paid,
										currency, p.method, p.paid_at?.slice(0, 10), p.notes,
									]),
								)
							}
							title="Ödemeleri CSV olarak indir"
						>
							<Download className="w-4 h-4" />
							CSV indir
						</Button>
					)}
					<Button size="sm" variant={form ? "ghost" : "outline"} onClick={() => (form ? setForm(null) : openCreate())}>
						{form ? "Vazgeç" : "+ Ödeme kaydet"}
					</Button>
				</div>
			</div>

			{form && (
				<form onSubmit={handleSubmit} className="mb-4 space-y-4 p-4 bg-base-200 rounded-2xl border border-base-300">
					{form.mode === "edit" && (
						<p className="text-xs font-semibold text-base-content/55">Ödeme düzenleniyor</p>
					)}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Dönem başlangıcı">
							<Input
								type="date"
								value={periodStart}
								onChange={(e) => { setPeriodStart(e.target.value); setPeriodEnd(plusOneMonth(e.target.value)); }}
								required
							/>
						</FormField>
						<FormField label="Dönem bitişi" error={fieldErrors.periodEnd}>
							<Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
						</FormField>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label={`Tutar (${currency})`} error={fieldErrors.amount}>
							<Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
						</FormField>
						<FormField label="Yöntem (isteğe bağlı)">
							<Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="nakit, havale, …" />
						</FormField>
					</div>
					{error && <Alert>{error}</Alert>}
					<Button type="submit" block loading={submitting}>
						{form.mode === "create" ? "Ödemeyi kaydet" : "Değişiklikleri kaydet"}
					</Button>
				</form>
			)}

			{!form && error && <Alert className="mb-3">{error}</Alert>}

			{loading ? (
				<div className="py-6 flex justify-center"><Spinner /></div>
			) : rows.length === 0 ? (
				<EmptyState
					icon={Receipt}
					title="Henüz ödeme kaydı yok"
					hint="Bakiyeyi takip etmeye başlamak için ilk kira ödemesini kaydedin."
					className="py-6"
				/>
			) : (
				<ul className="divide-y divide-base-300">
					{rows.map((p) => (
						<li key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
							<div className="min-w-0">
								<p className="font-numeric text-base-content font-semibold">{fmt(Number(p.amount_paid), currency)}</p>
								<p className="text-xs text-base-content/50 mt-0.5">
									{p.period_start} → {p.period_end}{p.method ? ` · ${p.method}` : ""}
								</p>
							</div>
							<div className="flex items-center gap-1 shrink-0">
								<p className="hidden sm:block text-xs text-base-content/50 whitespace-nowrap mr-2">
									{p.paid_at ? new Date(p.paid_at).toLocaleDateString("tr-TR") : "—"}
								</p>
								{onReceipt && (
									<button
										type="button"
										onClick={() => onReceipt(p)}
										aria-label="Makbuzu indir"
										title="Kira makbuzunu indir"
										className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
									>
										<Receipt className="w-4 h-4" />
									</button>
								)}
								<button
									type="button"
									onClick={() => openEdit(p)}
									aria-label="Ödemeyi düzenle"
									className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
								>
									<Pencil className="w-4 h-4" />
								</button>
								<button
									type="button"
									onClick={() => setDeleting(p)}
									aria-label="Ödemeyi sil"
									className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-error hover:bg-error/10 transition-colors"
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
				title="Bu ödeme silinsin mi?"
				message={
					deleting
						? `${deleting.period_start} → ${deleting.period_end} dönemi için ${fmt(Number(deleting.amount_paid), currency)}. Bu işlem geri alınamaz.`
						: undefined
				}
				confirmLabel="Sil"
				loading={deleteBusy}
				onConfirm={handleDelete}
				onCancel={() => setDeleting(null)}
			/>
		</div>
	);
}
