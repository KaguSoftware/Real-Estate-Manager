"use client";

import { useEffect, useState } from "react";
import {
	createTenant,
	updateTenant,
	deleteTenant,
	countLinkedRecordsForTenant,
	type TenantInput,
} from "@/src/lib/db/tenants";
import { invalidateCache } from "@/src/lib/useCachedResource";
import type { Tenant } from "@/src/lib/db/types";
import {
	Sheet, Button, FormField, Input, Textarea, Alert, ConfirmDialog, toast,
} from "@/src/components/ui";
import { required, validEmail, compactErrors } from "@/src/lib/validation";
import { Trash2 } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Tenant;
	onClose: () => void;
	onDone: () => void;
}

export function TenantForm({ mode, initial, onClose, onDone }: Props) {
	const [full_name, setFullName] = useState(initial?.full_name ?? "");
	const [phone, setPhone] = useState(initial?.phone ?? "");
	const [email, setEmail] = useState(initial?.email ?? "");
	const [national_id, setNationalId] = useState(initial?.national_id ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	// Delete guard: leases/sales referencing this tenant would be CASCADE-deleted
	// (payment history included), so deletion is blocked while links exist.
	const [linkedCount, setLinkedCount] = useState<number | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (mode !== "edit" || !initial) return;
		countLinkedRecordsForTenant(initial.id)
			.then(setLinkedCount)
			.catch(() => setLinkedCount(null)); // unknown → keep delete enabled, confirm handles errors
	}, [mode, initial]);

	function buildInput(): TenantInput {
		return {
			full_name: full_name.trim(),
			phone: phone.trim() || null,
			email: email.trim() || null,
			national_id: national_id.trim() || null,
			notes: notes.trim() || null,
		};
	}

	async function handleSubmit(e?: React.FormEvent) {
		e?.preventDefault();
		const errors = compactErrors({
			full_name: required(full_name, "Name"),
			email: validEmail(email),
		});
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;

		setBusy(true);
		setError(null);
		try {
			if (mode === "create") await createTenant(buildInput());
			else await updateTenant(initial!.id, buildInput());
			invalidateCache("tenants");
			toast.success(mode === "create" ? "Tenant added." : "Tenant updated.");
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		setBusy(true);
		try {
			await deleteTenant(initial.id);
			invalidateCache("tenants");
			toast.success("Tenant deleted.");
			setConfirmingDelete(false);
			onDone();
		} catch (err) {
			setConfirmingDelete(false);
			setError(err instanceof Error ? err.message : String(err));
			setBusy(false);
		}
	}

	const deleteBlocked = mode === "edit" && linkedCount !== null && linkedCount > 0;

	return (
		<Sheet
			open
			onClose={onClose}
			title={mode === "create" ? "Add tenant" : "Edit tenant"}
			footer={
				<div className="flex items-center gap-2">
					{mode === "edit" && (
						<Button
							variant="danger"
							size="md"
							onClick={() => setConfirmingDelete(true)}
							disabled={busy || deleteBlocked}
							aria-label="Delete tenant"
							title={deleteBlocked ? "Linked to leases or sales — remove those first." : undefined}
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					<Button variant="ghost" block onClick={onClose}>Cancel</Button>
					<Button block onClick={() => handleSubmit()} loading={busy}>
						{mode === "create" ? "Add tenant" : "Save"}
					</Button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				{error && <Alert>{error}</Alert>}

				{deleteBlocked && (
					<Alert tone="info">
						Linked to {linkedCount} lease{linkedCount === 1 ? "" : "s"}/sale{linkedCount === 1 ? "" : "s"} —
						deleting is disabled because it would also remove those agreements and their payment history.
					</Alert>
				)}

				<FormField label="Full name" error={fieldErrors.full_name}>
					<Input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Ahmet Yılmaz" autoFocus />
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Phone">
						<Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
					</FormField>
					<FormField label="Email" error={fieldErrors.email}>
						<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
					</FormField>
				</div>

				<FormField label="National ID (TC Kimlik)">
					<Input value={national_id} onChange={(e) => setNationalId(e.target.value)} placeholder="optional" />
				</FormField>

				<FormField label="Notes">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" />
				</FormField>
			</form>

			<ConfirmDialog
				open={confirmingDelete}
				title="Delete this tenant?"
				message={initial ? `"${initial.full_name}" will be removed permanently.` : undefined}
				confirmLabel="Delete"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</Sheet>
	);
}
