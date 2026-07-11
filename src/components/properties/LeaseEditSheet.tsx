"use client";

import { humanizeError } from "@/src/lib/errors";
import { useState } from "react";
import { updateLease, type LeaseUpdate } from "@/src/lib/db/leases";
import type { Lease } from "@/src/lib/db/types";
import { Sheet, FormField, Input, Select, Button, Alert, toast } from "@/src/components/ui";
import { positiveNumber, compactErrors } from "@/src/lib/validation";

interface Props {
	open: boolean;
	lease: Lease;
	onClose: () => void;
	/** Called after a successful save so the parent can reload. */
	onSaved: () => void;
}

/** Edit the financial/payment terms of an existing lease. */
export function LeaseEditSheet({ open, lease, onClose, onSaved }: Props) {
	const [monthlyRent, setMonthlyRent] = useState(String(lease.monthly_rent));
	const [deposit, setDeposit] = useState(String(lease.deposit));
	const currency = "TRY"; // product is TRY-only
	const [endDate, setEndDate] = useState(lease.end_date ?? "");
	const [paymentDay, setPaymentDay] = useState(lease.payment_day?.toString() ?? "");
	const [paymentMethod, setPaymentMethod] = useState(lease.payment_method ?? "");
	const [bankAccount, setBankAccount] = useState(lease.bank_account ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	function validate(): boolean {
		const errors = compactErrors({
			monthlyRent: positiveNumber(monthlyRent, "Monthly rent"),
			deposit: deposit.trim() && (!Number.isFinite(Number(deposit)) || Number(deposit) < 0)
				? "Deposit must be zero or more."
				: undefined,
			endDate:
				endDate && Date.parse(endDate) <= Date.parse(lease.start_date)
					? "End date must be after the lease start."
					: undefined,
			paymentDay:
				paymentDay.trim() && (Number(paymentDay) < 1 || Number(paymentDay) > 31)
					? "Payment day must be between 1 and 31."
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
				monthly_rent: Number(monthlyRent),
				deposit: deposit.trim() ? Number(deposit) : 0,
				currency,
				end_date: endDate || null,
				payment_day: paymentDay.trim() ? Number(paymentDay) : null,
				payment_method: paymentMethod.trim() || null,
				bank_account: bankAccount.trim() || null,
			};
			await updateLease(lease.id, patch);
			toast.success("Lease updated.");
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
			title="Edit lease"
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button onClick={handleSave} loading={busy}>Save changes</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Monthly rent" error={fieldErrors.monthlyRent}>
						<Input
							type="number" inputMode="decimal" min="0"
							value={monthlyRent}
							onChange={(e) => setMonthlyRent(e.target.value)}
						/>
					</FormField>
					<FormField label="Security deposit" error={fieldErrors.deposit}>
						<Input
							type="number" inputMode="decimal" min="0"
							value={deposit}
							onChange={(e) => setDeposit(e.target.value)}
						/>
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Currency">
						<Select value="TRY" disabled>
							<option value="TRY">TRY (₺)</option>
						</Select>
					</FormField>
					<FormField label="End date" hint="Leave empty for an open-ended lease." error={fieldErrors.endDate}>
						<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Payment day of month" error={fieldErrors.paymentDay}>
						<Input
							type="number" inputMode="numeric" min="1" max="31"
							value={paymentDay}
							onChange={(e) => setPaymentDay(e.target.value)}
							placeholder="e.g. 5"
						/>
					</FormField>
					<FormField label="Payment method">
						<Input
							value={paymentMethod}
							onChange={(e) => setPaymentMethod(e.target.value)}
							placeholder="Bank transfer"
						/>
					</FormField>
				</div>

				<FormField label="Bank account (IBAN)">
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
