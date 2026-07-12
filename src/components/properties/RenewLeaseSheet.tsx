"use client";

import { humanizeError } from "@/src/lib/errors";
import { useState } from "react";
import { computeLeaseEndDate, renewLease } from "@/src/lib/db/leases";
import { invalidateCache } from "@/src/lib/useCachedResource";
import type { Lease, LeaseTerm, Tenant } from "@/src/lib/db/types";
import { Sheet, FormField, Input, Dropdown, Button, Alert, toast, type DropdownOption } from "@/src/components/ui";
import { positiveNumber, compactErrors } from "@/src/lib/validation";

const TERM_OPTIONS: DropdownOption<LeaseTerm>[] = [
	{ value: "1yr", label: "1 yıl" },
	{ value: "2yr", label: "2 yıl" },
	{ value: "undefined", label: "Süresiz" },
];

interface Props {
	open: boolean;
	lease: Lease & { tenant: Tenant };
	onClose: () => void;
	/** Called after a successful renewal so the parent can reload. */
	onRenewed: () => void;
}

/**
 * Renew an active lease: ends the current lease on the new start date and
 * creates a replacement with the same tenant and terms, letting the agent
 * bump the rent (the common yearly kira-artışı case) before confirming.
 */
export function RenewLeaseSheet({ open, lease, onClose, onRenewed }: Props) {
	// New lease starts where the old one ends, falling back to today for
	// open-ended leases.
	const [startDate, setStartDate] = useState(
		lease.end_date ?? new Date().toISOString().slice(0, 10),
	);
	const [term, setTerm] = useState<LeaseTerm>(lease.term === "undefined" ? "1yr" : lease.term);
	const [monthlyRent, setMonthlyRent] = useState(String(lease.monthly_rent));
	const [deposit, setDeposit] = useState(String(lease.deposit));

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const newEndDate = computeLeaseEndDate(startDate, term);

	async function handleRenew() {
		setError(null);
		const errors = compactErrors({
			monthlyRent: positiveNumber(monthlyRent, "Aylık kira"),
			startDate: !startDate ? "Başlangıç tarihi zorunludur." : undefined,
		});
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;

		setBusy(true);
		try {
			await renewLease(lease, {
				start_date: startDate,
				term,
				monthly_rent: Number(monthlyRent),
				deposit: deposit.trim() ? Number(deposit) : 0,
			});
			invalidateCache("stats");
			invalidateCache("attention");
			toast.success(`${lease.tenant.full_name} için kira sözleşmesi yenilendi.`);
			onRenewed();
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
			title="Sözleşmeyi yenile"
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button>
					<Button onClick={handleRenew} loading={busy}>Sözleşmeyi yenile</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<p className="text-sm text-base-content/70">
					<span className="font-semibold">{lease.tenant.full_name}</span> ile mevcut kira sözleşmesi
					yeni başlangıç tarihinde sona erer ve aşağıdaki koşullarla yenisi başlar. Ödeme geçmişi korunur.
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Yeni başlangıç tarihi" error={fieldErrors.startDate}>
						<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
					</FormField>
					<FormField
						label="Süre"
						hint={newEndDate ? `Bitiş: ${newEndDate}` : "Süresiz"}
					>
						<Dropdown options={TERM_OPTIONS} value={term} onChange={setTerm} />
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label={`Aylık kira (${lease.currency})`} error={fieldErrors.monthlyRent}>
						<Input
							type="number" inputMode="decimal" min="0"
							value={monthlyRent}
							onChange={(e) => setMonthlyRent(e.target.value)}
						/>
					</FormField>
					<FormField label={`Depozito (${lease.currency})`}>
						<Input
							type="number" inputMode="decimal" min="0"
							value={deposit}
							onChange={(e) => setDeposit(e.target.value)}
						/>
					</FormField>
				</div>

				{error && <Alert>{error}</Alert>}
			</div>
		</Sheet>
	);
}
