"use client";

import { humanizeError } from "@/src/lib/errors";
import { useState } from "react";
import { computeLeaseEndDate, renewLease } from "@/src/lib/db/leases";
import { invalidateCache } from "@/src/lib/useCachedResource";
import type { Lease, LeaseTerm, Tenant } from "@/src/lib/db/types";
import { Sheet, FormField, Input, Select, Button, Alert, toast } from "@/src/components/ui";
import { positiveNumber, compactErrors } from "@/src/lib/validation";

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
			monthlyRent: positiveNumber(monthlyRent, "Monthly rent"),
			startDate: !startDate ? "Start date is required." : undefined,
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
			toast.success(`Lease renewed for ${lease.tenant.full_name}.`);
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
			title="Renew lease"
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button onClick={handleRenew} loading={busy}>Renew lease</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<p className="text-sm text-slate-600">
					The current lease for <span className="font-semibold">{lease.tenant.full_name}</span> ends
					on the new start date and a new one begins with the terms below. Payment history is kept.
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="New start date" error={fieldErrors.startDate}>
						<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
					</FormField>
					<FormField
						label="Term"
						hint={newEndDate ? `Ends ${newEndDate}` : "Open-ended"}
					>
						<Select value={term} onChange={(e) => setTerm(e.target.value as LeaseTerm)}>
							<option value="1yr">1 year</option>
							<option value="2yr">2 years</option>
							<option value="undefined">Open-ended</option>
						</Select>
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label={`Monthly rent (${lease.currency})`} error={fieldErrors.monthlyRent}>
						<Input
							type="number" inputMode="decimal" min="0"
							value={monthlyRent}
							onChange={(e) => setMonthlyRent(e.target.value)}
						/>
					</FormField>
					<FormField label={`Security deposit (${lease.currency})`}>
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
