"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { createLead, updateLead, deleteLead, type LeadInput } from "@/src/lib/db/leads";
import type { Lead, LeadStatus, ListingType } from "@/src/lib/db/types";
import { FormField, inputClass } from "@/src/components/ui/FormField";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./leadStatus";
import { X, Trash2, Search } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Lead;
	onClose: () => void;
	onDone: () => void;
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

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!full_name.trim()) { setError("Name is required."); return; }
		setBusy(true);
		setError(null);
		try {
			const input = buildInput();
			const row = mode === "create"
				? await createLead(input)
				: await updateLead(initial!.id, input);
			upsertLead(row);
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		if (!confirm(`Delete lead "${initial.full_name}"? This can't be undone.`)) return;
		setBusy(true);
		try {
			await deleteLead(initial.id);
			removeLead(initial.id);
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setBusy(false);
		}
	}

	/** Push this lead's structured prefs into the property filters and open the dashboard. */
	function findMatches() {
		setFilters({
			listing_type: pref_listing_type || "all",
			nitelik: pref_nitelik.trim(),
			min_bedrooms: pref_min_bedrooms ? Number(pref_min_bedrooms) : null,
			location: pref_location.trim(),
			status: "all",
			q: "",
		});
		router.push("/");
	}

	const hasPrefs =
		!!pref_listing_type || !!pref_nitelik.trim() || !!pref_min_bedrooms || !!pref_location.trim();

	return (
		<div
			className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-3 sm:p-6 overflow-y-auto"
			onClick={onClose}
		>
			<div
				className="w-full max-w-lg bg-white rounded-2xl shadow-xl my-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
					<h2 className="text-base font-bold text-slate-900">
						{mode === "create" ? "Add lead" : "Edit lead"}
					</h2>
					<button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
					{error && (
						<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
					)}

					<FormField label="Name">
						<input className={inputClass} value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Client name" />
					</FormField>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Phone">
							<input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
						</FormField>
						<FormField label="Email">
							<input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
						</FormField>
					</div>

					<FormField label="Interested in">
						<textarea
							className={`${inputClass} min-h-20`}
							value={interested_in}
							onChange={(e) => setInterestedIn(e.target.value)}
							placeholder="e.g. 3+1 with a garden, near the center"
						/>
					</FormField>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Status">
							<select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
								{LEAD_STATUS_ORDER.map((s) => (
									<option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
								))}
							</select>
						</FormField>
						<FormField label="Last call">
							<input type="date" className={inputClass} value={last_call_at} onChange={(e) => setLastCallAt(e.target.value)} />
						</FormField>
					</div>

					{/* Structured search prefs */}
					<div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4">
						<p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
							Search preferences (optional)
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<FormField label="Looking to">
								<select className={inputClass} value={pref_listing_type} onChange={(e) => setPrefListingType(e.target.value as ListingType | "")}>
									<option value="">Any</option>
									<option value="for_rent">Rent</option>
									<option value="for_sale">Buy</option>
								</select>
							</FormField>
							<FormField label="Type (e.g. 3+1)">
								<input className={inputClass} value={pref_nitelik} onChange={(e) => setPrefNitelik(e.target.value)} placeholder="3+1" />
							</FormField>
							<FormField label="Min bedrooms">
								<input className={inputClass} type="number" min={0} value={pref_min_bedrooms} onChange={(e) => setPrefMinBedrooms(e.target.value)} placeholder="3" />
							</FormField>
							<FormField label="Location / site">
								<input className={inputClass} value={pref_location} onChange={(e) => setPrefLocation(e.target.value)} placeholder="neighborhood or site" />
							</FormField>
						</div>
						<button
							type="button"
							onClick={findMatches}
							disabled={!hasPrefs}
							className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
						>
							<Search className="w-3.5 h-3.5" />
							Find matching properties
						</button>
					</div>

					<FormField label="Notes">
						<textarea
							className={`${inputClass} min-h-20`}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Anything worth remembering…"
						/>
					</FormField>

					<div className="flex items-center justify-between gap-3 pt-2">
						{mode === "edit" ? (
							<button
								type="button"
								onClick={handleDelete}
								disabled={busy}
								className="px-3 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
							>
								<Trash2 className="w-3.5 h-3.5" />
								Delete
							</button>
						) : <span />}

						<div className="flex items-center gap-2">
							<button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
								Cancel
							</button>
							<button
								type="submit"
								disabled={busy}
								className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
							>
								{busy ? "Saving…" : mode === "create" ? "Add lead" : "Save"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
