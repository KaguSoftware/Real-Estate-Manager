"use client";

import { useState } from "react";
import { humanizeError } from "@/src/lib/errors";
import { useAppStore } from "@/src/store";
import { createProject, updateProject, deleteProject, type ProjectInput } from "@/src/lib/db/projects";
import type { Project } from "@/src/lib/db/types";
import {
	Sheet, Button, FormField, Input, NumberInput, Textarea, Dropdown, DatePicker,
	Alert, ConfirmDialog, toast, type DropdownOption,
} from "@/src/components/ui";
import { compactErrors } from "@/src/lib/validation";
import { Trash2 } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Project;
	onClose: () => void;
	onDone: () => void;
}

// Same set the budget controls use — no FX conversion anywhere, so a project's
// entry price is only ever compared against a budget in the same currency.
const CURRENCY_OPTIONS: DropdownOption<string>[] = [
	{ value: "TRY", label: "₺ TRY" },
	{ value: "USD", label: "$ USD" },
	{ value: "EUR", label: "€ EUR" },
];

/** Reject anything that isn't an https:// URL — the value is rendered as an
 *  outbound link, and the db schema enforces the same rule. */
function validDriveUrl(value: string): string | undefined {
	if (!value.trim()) return undefined;
	try {
		if (new URL(value.trim()).protocol !== "https:") return "Bağlantı https:// ile başlamalıdır.";
		return undefined;
	} catch {
		return "Geçerli bir bağlantı girin.";
	}
}

export function ProjectForm({ mode, initial, onClose, onDone }: Props) {
	const upsertProject = useAppStore((s) => s.upsertProject);
	const removeProject = useAppStore((s) => s.removeProject);

	const [name, setName] = useState(initial?.name ?? "");
	const [developer_name, setDeveloperName] = useState(initial?.developer_name ?? "");
	const [drive_url, setDriveUrl] = useState(initial?.drive_url ?? "");
	const [city, setCity] = useState(initial?.city ?? "");
	const [mahalle, setMahalle] = useState(initial?.mahalle ?? "");
	const [delivery_date, setDeliveryDate] = useState(initial?.delivery_date ?? "");
	const [price_from, setPriceFrom] = useState<number | null>(initial?.price_from ?? null);
	const [price_currency, setPriceCurrency] = useState(initial?.price_currency ?? "TRY");
	const [notes, setNotes] = useState(initial?.notes ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	function buildInput(): ProjectInput {
		return {
			name: name.trim(),
			developer_name: developer_name.trim() || null,
			drive_url: drive_url.trim() || null,
			city: city.trim() || null,
			mahalle: mahalle.trim() || null,
			delivery_date: delivery_date || null,
			price_from,
			price_currency,
			notes: notes.trim() || null,
		};
	}

	async function handleSubmit(e?: React.FormEvent) {
		e?.preventDefault();
		const errors = compactErrors({
			name: name.trim() ? undefined : "Proje adı zorunludur.",
			drive_url: validDriveUrl(drive_url),
		});
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;

		setBusy(true);
		setError(null);
		try {
			const saved =
				mode === "create"
					? await createProject(buildInput())
					: await updateProject(initial!.id, buildInput());
			upsertProject(saved);
			toast.success(mode === "create" ? "Proje eklendi." : "Proje güncellendi.");
			onDone();
		} catch (err) {
			setError(humanizeError(err));
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		setBusy(true);
		try {
			await deleteProject(initial.id);
			removeProject(initial.id);
			toast.success("Proje silindi.");
			onDone();
		} catch (err) {
			setError(humanizeError(err));
			setBusy(false);
			setConfirmingDelete(false);
		}
	}

	return (
		<Sheet
			open
			onClose={onClose}
			title={mode === "create" ? "Proje ekle" : "Projeyi düzenle"}
			footer={
				<div className="flex items-center gap-3">
					{mode === "edit" && (
						<Button variant="danger" size="md" onClick={() => setConfirmingDelete(true)} disabled={busy} aria-label="Projeyi sil">
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					<Button variant="outline" block onClick={onClose} disabled={busy}>Vazgeç</Button>
					<Button block onClick={() => handleSubmit()} disabled={busy}>
						{busy ? "Kaydediliyor…" : "Kaydet"}
					</Button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && <Alert>{error}</Alert>}

				<FormField label="Proje adı" error={fieldErrors.name}>
					<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Vadi Panorama" />
				</FormField>

				<FormField label="Müteahhit firma" hint="Projeler bu firmaya göre gruplanır.">
					<Input value={developer_name} onChange={(e) => setDeveloperName(e.target.value)} placeholder="örn. Kuzu İnşaat" />
				</FormField>

				{/* The load-bearing field: catalogs, videos and drone footage all live
				    in the developer's shared Drive folder rather than in this app. */}
				<FormField
					label="Drive bağlantısı"
					hint="Firmanın paylaştığı katalog/görsel klasörü."
					error={fieldErrors.drive_url}
				>
					<Input
						type="url"
						inputMode="url"
						value={drive_url}
						onChange={(e) => setDriveUrl(e.target.value)}
						placeholder="https://drive.google.com/…"
					/>
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Şehir">
						<Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="örn. İzmir" />
					</FormField>
					<FormField label="Mahalle / mevkii">
						<Input value={mahalle} onChange={(e) => setMahalle(e.target.value)} placeholder="örn. Alsancak" />
					</FormField>
				</div>

				<FormField label="Başlangıç fiyatı" hint="Müşteri bütçesiyle eşleştirmek için kullanılır.">
					<div className="flex flex-wrap items-center gap-2">
						<NumberInput
							mode="decimal"
							format="money"
							min={0}
							value={price_from}
							onChange={setPriceFrom}
							placeholder="örn. 4.500.000"
							aria-label="Başlangıç fiyatı"
							className="flex-1 min-w-28"
						/>
						<Dropdown
							options={CURRENCY_OPTIONS}
							value={price_currency}
							onChange={setPriceCurrency}
							className="shrink-0 basis-32"
							aria-label="Para birimi"
						/>
					</div>
				</FormField>

				<FormField label="Teslim tarihi">
					<DatePicker value={delivery_date} onChange={setDeliveryDate} />
				</FormField>

				<FormField label="Notlar">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ödeme koşulları, kampanya, kat planı notları…" />
				</FormField>
			</form>

			<ConfirmDialog
				open={confirmingDelete}
				title="Proje silinsin mi?"
				message="Bu proje kalıcı olarak silinecek. Projeye bağlı taşınmazlar silinmez, yalnızca proje bağlantıları kaldırılır."
				confirmLabel="Sil"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</Sheet>
	);
}
