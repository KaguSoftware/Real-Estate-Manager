"use client";

import { humanizeError } from "@/src/lib/errors";
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
	Sheet, Button, FormField, Input, EmailInput, PhoneInput, Textarea, Alert, ConfirmDialog, toast,
} from "@/src/components/ui";
import { required, validEmail, compactErrors } from "@/src/lib/validation";
import { ActivityTimeline } from "@/src/components/contacts/ActivityTimeline";
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
			full_name: required(full_name, "Ad soyad"),
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
			toast.success(mode === "create" ? "Kiracı eklendi." : "Kiracı güncellendi.");
			onDone();
		} catch (err) {
			setError(humanizeError(err));
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
			toast.success("Kiracı silindi.");
			setConfirmingDelete(false);
			onDone();
		} catch (err) {
			setConfirmingDelete(false);
			setError(humanizeError(err));
			setBusy(false);
		}
	}

	const deleteBlocked = mode === "edit" && linkedCount !== null && linkedCount > 0;

	return (
		<Sheet
			open
			onClose={onClose}
			title={mode === "create" ? "Kiracı ekle" : "Kiracıyı düzenle"}
			footer={
				<div className="flex items-center gap-3">
					{mode === "edit" && (
						<Button
							variant="danger"
							size="md"
							onClick={() => setConfirmingDelete(true)}
							disabled={busy || deleteBlocked}
							aria-label="Kiracıyı sil"
							title={deleteBlocked ? "Kira sözleşmesi veya satış kaydına bağlı — önce onları kaldırın." : undefined}
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					<Button variant="outline" block onClick={onClose}>Vazgeç</Button>
					<Button block onClick={() => handleSubmit()} loading={busy}>
						{mode === "create" ? "Kiracı ekle" : "Kaydet"}
					</Button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				{error && <Alert>{error}</Alert>}

				{deleteBlocked && (
					<Alert tone="info">
						Bu kiracı {linkedCount} kira sözleşmesine/satış kaydına bağlı —
						silme devre dışı bırakıldı çünkü bu sözleşmeler ve ödeme geçmişleri de silinirdi.
					</Alert>
				)}

				<FormField label="Ad soyad" error={fieldErrors.full_name}>
					<Input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Ahmet Yılmaz" autoFocus />
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Telefon">
						<PhoneInput value={phone} onChange={setPhone} placeholder="+90 5xx xxx xx xx" />
					</FormField>
					<FormField label="E-posta" error={fieldErrors.email}>
						<EmailInput
							value={email}
							onChange={setEmail}
							placeholder="isteğe bağlı"
							onValidChange={(err) => setFieldErrors((f) => compactErrors({ ...f, email: err }))}
						/>
					</FormField>
				</div>

				<FormField label="TC Kimlik No">
					<Input value={national_id} onChange={(e) => setNationalId(e.target.value)} placeholder="isteğe bağlı" />
				</FormField>

				<FormField label="Notlar">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hatırlamaya değer her şey…" />
				</FormField>

				{/* Only on edit — a new tenant has no id to attach activity to yet. */}
				{mode === "edit" && initial && <ActivityTimeline tenantId={initial.id} />}
			</form>

			<ConfirmDialog
				open={confirmingDelete}
				title="Bu kiracı silinsin mi?"
				message={initial ? `"${initial.full_name}" kalıcı olarak silinecek.` : undefined}
				confirmLabel="Sil"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</Sheet>
	);
}
