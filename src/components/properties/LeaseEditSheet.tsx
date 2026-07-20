"use client";

import { humanizeError } from "@/src/lib/errors";
import { useState } from "react";
import { updateLease, type LeaseUpdate } from "@/src/lib/db/leases";
import type { Lease } from "@/src/lib/db/types";
import { Sheet, FormField, Input, NumberInput, DatePicker, Dropdown, Button, Alert, toast } from "@/src/components/ui";
import { positiveNumberValue, compactErrors } from "@/src/lib/validation";

interface Props {
	open: boolean;
	lease: Lease;
	onClose: () => void;
	/** Called after a successful save so the parent can reload. */
	onSaved: () => void;
}

/** Edit the financial/payment terms of an existing lease. */
export function LeaseEditSheet({ open, lease, onClose, onSaved }: Props) {
	const [monthlyRent, setMonthlyRent] = useState<number | null>(Number(lease.monthly_rent));
	const [deposit, setDeposit] = useState<number | null>(Number(lease.deposit));
	const currency = "TRY"; // product is TRY-only
	const [endDate, setEndDate] = useState(lease.end_date ?? "");
	const [paymentDay, setPaymentDay] = useState<number | null>(lease.payment_day ?? null);
	const [paymentMethod, setPaymentMethod] = useState(lease.payment_method ?? "");
	const [bankAccount, setBankAccount] = useState(lease.bank_account ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	function validate(): boolean {
		const errors = compactErrors({
			monthlyRent: positiveNumberValue(monthlyRent, "Aylık kira"),
			deposit: deposit !== null && deposit < 0
				? "Depozito sıfır veya daha büyük olmalıdır."
				: undefined,
			endDate:
				endDate && Date.parse(endDate) <= Date.parse(lease.start_date)
					? "Bitiş tarihi sözleşme başlangıcından sonra olmalıdır."
					: undefined,
			paymentDay:
				paymentDay !== null && (paymentDay < 1 || paymentDay > 31)
					? "Ödeme günü 1 ile 31 arasında olmalıdır."
					: undefined,
		});
		setFieldErrors(errors);
		return Object.keys(errors).length === 0;
	}

	async function handleSave() {
		setError(null);
		if (!validate()) return;
		setBusy(true);
		try {
			const patch: LeaseUpdate = {
				monthly_rent: monthlyRent as number,
				deposit: deposit ?? 0,
				currency,
				end_date: endDate || null,
				payment_day: paymentDay,
				payment_method: paymentMethod.trim() || null,
				bank_account: bankAccount.trim() || null,
			};
			await updateLease(lease.id, patch);
			toast.success("Kira sözleşmesi güncellendi.");
			onSaved();
			onClose();
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title="Sözleşmeyi düzenle"
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button>
					<Button onClick={handleSave} loading={busy}>Değişiklikleri kaydet</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Aylık kira" error={fieldErrors.monthlyRent}>
						<NumberInput mode="decimal" format="money" min={0} value={monthlyRent} onChange={setMonthlyRent} />
					</FormField>
					<FormField label="Depozito" error={fieldErrors.deposit}>
						<NumberInput mode="decimal" format="money" min={0} value={deposit} onChange={setDeposit} />
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Para birimi">
						<Dropdown options={[{ value: "TRY", label: "TL" }]} value="TRY" onChange={() => {}} disabled />
					</FormField>
					<FormField label="Bitiş tarihi" hint="Süresiz sözleşme için boş bırakın." error={fieldErrors.endDate}>
						<DatePicker value={endDate} onChange={setEndDate} />
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Ayın ödeme günü" error={fieldErrors.paymentDay}>
						<NumberInput min={1} max={31} value={paymentDay} onChange={setPaymentDay} placeholder="örn. 5" />
					</FormField>
					<FormField label="Ödeme yöntemi">
						<Input
							value={paymentMethod}
							onChange={(e) => setPaymentMethod(e.target.value)}
							placeholder="Banka havalesi"
						/>
					</FormField>
				</div>

				<FormField label="Banka hesabı (IBAN)">
					<Input
						value={bankAccount}
						onChange={(e) => setBankAccount(e.target.value)}
						placeholder="TR__ ____ ____ …"
					/>
				</FormField>

				{error && <Alert>{error}</Alert>}
			</div>
		</Sheet>
	);
}
