"use client";

import { humanizeError } from "@/src/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { createLead, updateLead, deleteLead, type LeadInput } from "@/src/lib/db/leads";
import type { Lead, LeadStatus, ListingType } from "@/src/lib/db/types";
import { Sheet, Button, FormField, Input, NumberInput, EmailInput, PhoneInput, Textarea, Dropdown, Alert, ConfirmDialog, toast, type DropdownOption } from "@/src/components/ui";
import { validEmail, compactErrors } from "@/src/lib/validation";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./leadStatus";
import { AssigneeSelect } from "@/src/components/team/AssigneeSelect";
import { Trash2, Search } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Lead;
	onClose: () => void;
	onDone: () => void;
}

const PREF_LISTING_TYPE_OPTIONS: DropdownOption<ListingType | "">[] = [
	{ value: "", label: "Fark etmez" },
	{ value: "for_rent", label: "Kiralamak" },
	{ value: "for_sale", label: "Satın almak" },
];

const STATUS_OPTIONS: DropdownOption<LeadStatus>[] = LEAD_STATUS_ORDER.map((s) => ({
	value: s,
	label: LEAD_STATUS_META[s].label,
}));

/** Eyebrow heading separating field groups inside the form. */
function GroupTitle({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-sm font-semibold text-base-content/60 pt-1">{children}</p>
	);
}

export function LeadForm({ mode, initial, onClose, onDone }: Props) {
	const router = useRouter();
	const upsertLead = useAppStore((s) => s.upsertLead);
	const removeLead = useAppStore((s) => s.removeLead);
	const setFilters = useAppStore((s) => s.setFilters);

	const [full_name, setFullName]   = useState(initial?.full_name ?? "");
	const [phone, setPhone]          = useState(initial?.phone ?? "");
	const [email, setEmail]          = useState(initial?.email ?? "");
	const [interested_in, setInterestedIn] = useState(initial?.interested_in ?? "");
	const [status, setStatus]        = useState<LeadStatus>(initial?.status ?? "new");
	const [notes, setNotes]          = useState(initial?.notes ?? "");
	const [last_call_at, setLastCallAt] = useState(initial?.last_call_at ?? "");

	// Structured prefs
	const [pref_listing_type, setPrefListingType] = useState<ListingType | "">(initial?.pref_listing_type ?? "");
	const [pref_nitelik, setPrefNitelik]   = useState(initial?.pref_nitelik ?? "");
	const [pref_min_bedrooms, setPrefMinBedrooms] = useState<number | null>(initial?.pref_min_bedrooms ?? null);
	const [pref_location, setPrefLocation] = useState(initial?.pref_location ?? "");

	const [assignedTo, setAssignedTo] = useState<string | null>(initial?.assigned_to ?? null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	function buildInput(): LeadInput {
		return {
			full_name: full_name.trim(),
			phone: phone.trim() || null,
			email: email.trim() || null,
			interested_in: interested_in.trim() || null,
			pref_listing_type: pref_listing_type || null,
			pref_nitelik: pref_nitelik.trim() || null,
			pref_min_bedrooms,
			pref_location: pref_location.trim() || null,
			status,
			notes: notes.trim() || null,
			last_call_at: last_call_at || null,
			assigned_to: assignedTo,
		};
	}

	async function handleSubmit(e?: React.FormEvent) {
		e?.preventDefault();
		const errors = compactErrors({
			full_name: full_name.trim() ? undefined : "Ad zorunludur.",
			email: validEmail(email),
		});
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;
		setBusy(true);
		setError(null);
		try {
			const input = buildInput();
			const row = mode === "create"
				? await createLead(input)
				: await updateLead(initial!.id, input);
			upsertLead(row);
			toast.success(mode === "create" ? "Müşteri eklendi." : "Müşteri güncellendi.");
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
			await deleteLead(initial.id);
			removeLead(initial.id);
			toast.success("Müşteri silindi.");
			onDone();
		} catch (err) {
			setConfirmingDelete(false);
			setError(humanizeError(err));
			setBusy(false);
		}
	}

	/** Push this lead's structured prefs into the property filters and open the dashboard. */
	function findMatches() {
		setFilters({
			listing_type: pref_listing_type || "all",
			nitelik: pref_nitelik.trim() ? [pref_nitelik.trim()] : [],
			furnished: "all",
			location: pref_location.trim() ? [pref_location.trim()] : [],
			status: "all",
			q: "",
		});
		router.push("/properties");
	}

	const hasPrefs =
		!!pref_listing_type || !!pref_nitelik.trim() || pref_min_bedrooms !== null || !!pref_location.trim();

	return (
		<Sheet
			open
			onClose={onClose}
			title={mode === "create" ? "Müşteri ekle" : "Müşteriyi düzenle"}
			footer={
				<div className="flex items-center gap-3">
					{mode === "edit" && (
						<Button variant="danger" size="md" onClick={() => setConfirmingDelete(true)} disabled={busy} aria-label="Müşteriyi sil">
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					<Button variant="outline" block onClick={onClose}>Vazgeç</Button>
					<Button block onClick={() => handleSubmit()} loading={busy}>
						{mode === "create" ? "Müşteri ekle" : "Kaydet"}
					</Button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				{error && <Alert>{error}</Alert>}

				{/* Contact */}
				<GroupTitle>İletişim</GroupTitle>
				<FormField label="Ad" error={fieldErrors.full_name}>
					<Input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Müşteri adı" autoFocus />
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

				{/* Interest */}
				<GroupTitle>İlgi alanı</GroupTitle>
				<FormField label="İlgilendiği">
					<Textarea value={interested_in} onChange={(e) => setInterestedIn(e.target.value)} placeholder="örn. bahçeli 3+1, merkeze yakın" />
				</FormField>

				<div className="rounded-2xl bg-base-200 border border-base-300 p-4 space-y-4">
					<p className="text-sm font-semibold text-base-content/60">Arama tercihleri (isteğe bağlı)</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Amaç">
							<Dropdown options={PREF_LISTING_TYPE_OPTIONS} value={pref_listing_type} onChange={setPrefListingType} />
						</FormField>
						<FormField label="Nitelik (örn. 3+1)">
							<Input value={pref_nitelik} onChange={(e) => setPrefNitelik(e.target.value)} placeholder="3+1" />
						</FormField>
						<FormField label="En az yatak odası">
							<NumberInput min={0} value={pref_min_bedrooms} onChange={setPrefMinBedrooms} placeholder="3" />
						</FormField>
						<FormField label="Konum / site">
							<Input value={pref_location} onChange={(e) => setPrefLocation(e.target.value)} placeholder="Mahalle veya site" />
						</FormField>
					</div>
					<Button type="button" variant="primary" block onClick={findMatches} disabled={!hasPrefs}>
						<Search className="w-4 h-4" />
						Eşleşen taşınmazları bul
					</Button>
				</div>

				{/* Status & follow-up */}
				<GroupTitle>Durum ve takip</GroupTitle>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Durum">
						<Dropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} />
					</FormField>
					<FormField label="Son arama">
						<Input type="date" value={last_call_at ?? ""} onChange={(e) => setLastCallAt(e.target.value)} />
					</FormField>
				</div>

				<FormField label="Atanan danışman" hint="Sorumlu kişi — tüm ekip yine de görebilir.">
					<AssigneeSelect value={assignedTo} onChange={setAssignedTo} />
				</FormField>

				{/* Notes */}
				<GroupTitle>Notlar</GroupTitle>
				<FormField label="Notlar">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hatırlanmaya değer her şey…" />
				</FormField>
			</form>

			<ConfirmDialog
				open={confirmingDelete}
				title="Bu müşteri silinsin mi?"
				message={initial ? `"${initial.full_name}" kalıcı olarak silinecek.` : undefined}
				confirmLabel="Sil"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</Sheet>
	);
}
