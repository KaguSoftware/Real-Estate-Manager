"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { createLead, updateLead, deleteLead, type LeadInput } from "@/src/lib/db/leads";
import type { Lead, LeadStatus, ListingType } from "@/src/lib/db/types";
import { Sheet, Button, FormField, Input, Textarea, Select, Alert, ConfirmDialog, toast } from "@/src/components/ui";
import { validEmail, compactErrors } from "@/src/lib/validation";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./leadStatus";
import { Trash2, Search } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Lead;
	onClose: () => void;
	onDone: () => void;
}

/** Eyebrow heading separating field groups inside the form. */
function GroupTitle({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">{children}</p>
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
	const [pref_min_bedrooms, setPrefMinBedrooms] = useState(initial?.pref_min_bedrooms?.toString() ?? "");
	const [pref_location, setPrefLocation] = useState(initial?.pref_location ?? "");

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
			pref_min_bedrooms: pref_min_bedrooms ? Number(pref_min_bedrooms) : null,
			pref_location: pref_location.trim() || null,
			status,
			notes: notes.trim() || null,
			last_call_at: last_call_at || null,
		};
	}

	async function handleSubmit(e?: React.FormEvent) {
		e?.preventDefault();
		const errors = compactErrors({
			full_name: full_name.trim() ? undefined : "Name is required.",
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
			toast.success(mode === "create" ? "Lead added." : "Lead updated.");
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
			await deleteLead(initial.id);
			removeLead(initial.id);
			toast.success("Lead deleted.");
			onDone();
		} catch (err) {
			setConfirmingDelete(false);
			setError(err instanceof Error ? err.message : String(err));
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
		!!pref_listing_type || !!pref_nitelik.trim() || !!pref_min_bedrooms || !!pref_location.trim();

	return (
		<Sheet
			open
			onClose={onClose}
			title={mode === "create" ? "Add lead" : "Edit lead"}
			footer={
				<div className="flex items-center gap-2">
					{mode === "edit" && (
						<Button variant="danger" size="md" onClick={() => setConfirmingDelete(true)} disabled={busy} aria-label="Delete lead">
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					<Button variant="ghost" block onClick={onClose}>Cancel</Button>
					<Button block onClick={() => handleSubmit()} loading={busy}>
						{mode === "create" ? "Add lead" : "Save"}
					</Button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				{error && <Alert>{error}</Alert>}

				{/* Contact */}
				<GroupTitle>Contact</GroupTitle>
				<FormField label="Name" error={fieldErrors.full_name}>
					<Input value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Client name" autoFocus />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Phone">
						<Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
					</FormField>
					<FormField label="Email" error={fieldErrors.email}>
						<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
					</FormField>
				</div>

				{/* Interest */}
				<GroupTitle>Interest</GroupTitle>
				<FormField label="Interested in">
					<Textarea value={interested_in} onChange={(e) => setInterestedIn(e.target.value)} placeholder="e.g. 3+1 with a garden, near the center" />
				</FormField>

				<div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
					<p className="text-xs font-bold uppercase tracking-wider text-slate-500">Search preferences (optional)</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Looking to">
							<Select value={pref_listing_type} onChange={(e) => setPrefListingType(e.target.value as ListingType | "")}>
								<option value="">Any</option>
								<option value="for_rent">Rent</option>
								<option value="for_sale">Buy</option>
							</Select>
						</FormField>
						<FormField label="Type (e.g. 3+1)">
							<Input value={pref_nitelik} onChange={(e) => setPrefNitelik(e.target.value)} placeholder="3+1" />
						</FormField>
						<FormField label="Min bedrooms">
							<Input type="number" inputMode="numeric" min={0} value={pref_min_bedrooms} onChange={(e) => setPrefMinBedrooms(e.target.value)} placeholder="3" />
						</FormField>
						<FormField label="Location / site">
							<Input value={pref_location} onChange={(e) => setPrefLocation(e.target.value)} placeholder="Neighborhood or site" />
						</FormField>
					</div>
					<Button type="button" variant="primary" block onClick={findMatches} disabled={!hasPrefs}>
						<Search className="w-4 h-4" />
						Find matching properties
					</Button>
				</div>

				{/* Status & follow-up */}
				<GroupTitle>Status &amp; follow-up</GroupTitle>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Status">
						<Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
							{LEAD_STATUS_ORDER.map((s) => (
								<option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
							))}
						</Select>
					</FormField>
					<FormField label="Last call">
						<Input type="date" value={last_call_at ?? ""} onChange={(e) => setLastCallAt(e.target.value)} />
					</FormField>
				</div>

				{/* Notes */}
				<GroupTitle>Notes</GroupTitle>
				<FormField label="Notes">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" />
				</FormField>
			</form>

			<ConfirmDialog
				open={confirmingDelete}
				title="Delete this lead?"
				message={initial ? `"${initial.full_name}" will be removed permanently.` : undefined}
				confirmLabel="Delete"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</Sheet>
	);
}
