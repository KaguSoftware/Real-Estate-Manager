"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import {
	createProperty,
	updateProperty,
	deleteProperty,
	type PropertyInput,
} from "@/src/lib/db/properties";
import type { Property, ListingType, PropertyStatus } from "@/src/lib/db/types";
import { FormField, inputClass } from "@/src/components/ui/FormField";

interface Props {
	mode: "create" | "edit";
	initial?: Property;
	onDone?: () => void;
	onCancel?: () => void;
}

export function PropertyForm({ mode, initial, onDone, onCancel }: Props) {
	const router = useRouter();
	const upsertProperty = useAppStore((s) => s.upsertProperty);
	const removeProperty = useAppStore((s) => s.removeProperty);
	const selectProperty = useAppStore((s) => s.selectProperty);

	const [homeowner_name, setHomeownerName] = useState(initial?.homeowner_name ?? "");
	const [address_line,   setAddressLine]   = useState(initial?.address_line ?? "");
	const [city,           setCity]          = useState(initial?.city ?? "");
	const [size_sqm,       setSizeSqm]       = useState(initial?.size_sqm?.toString() ?? "");
	const [bedrooms,       setBedrooms]      = useState(initial?.bedrooms?.toString() ?? "");
	const [bathrooms,      setBathrooms]     = useState(initial?.bathrooms?.toString() ?? "");
	const [listing_type,   setListingType]   = useState<ListingType>(initial?.listing_type ?? "for_rent");
	const [status,         setStatus]        = useState<PropertyStatus>(initial?.status ?? "vacant");
	const [list_price,     setListPrice]     = useState(initial?.list_price?.toString() ?? "");
	const [currency,       setCurrency]      = useState(initial?.currency ?? "USD");
	const [notes,          setNotes]         = useState(initial?.notes ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);

		const input: PropertyInput = {
			homeowner_name: homeowner_name.trim(),
			address_line: address_line.trim(),
			city: city.trim() || null,
			size_sqm: size_sqm.trim() ? Number(size_sqm) : null,
			bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
			bathrooms: bathrooms.trim() ? Number(bathrooms) : null,
			listing_type,
			status,
			list_price: list_price.trim() ? Number(list_price) : null,
			currency,
			notes: notes.trim() || null,
		};

		try {
			const row =
				mode === "create"
					? await createProperty(input)
					: await updateProperty(initial!.id, input);
			upsertProperty(row);
			if (mode === "create") {
				selectProperty(row.id);
				router.push("/");
			}
			onDone?.();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		if (!confirm(`Delete "${initial.address_line}"? This cannot be undone.`)) return;
		setBusy(true);
		try {
			await deleteProperty(initial.id);
			removeProperty(initial.id);
			selectProperty(null);
			onDone?.();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<FormField label="Homeowner Name">
					<input
						required
						value={homeowner_name}
						onChange={(e) => setHomeownerName(e.target.value)}
						className={inputClass}
						placeholder="Jane Doe"
					/>
				</FormField>
				<FormField label="Listing Type">
					<select
						value={listing_type}
						onChange={(e) => setListingType(e.target.value as ListingType)}
						className={inputClass}
					>
						<option value="for_rent">For Rent</option>
						<option value="for_sale">For Sale</option>
					</select>
				</FormField>
			</div>

			<FormField label="Address">
				<input
					required
					value={address_line}
					onChange={(e) => setAddressLine(e.target.value)}
					className={inputClass}
					placeholder="123 Main Street, Apt 4B"
				/>
			</FormField>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<FormField label="City">
					<input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
				</FormField>
				<FormField label="Size (m²)">
					<input
						type="number"
						min="0"
						value={size_sqm}
						onChange={(e) => setSizeSqm(e.target.value)}
						className={inputClass}
					/>
				</FormField>
				<FormField label="Bedrooms">
					<input
						type="number"
						min="0"
						value={bedrooms}
						onChange={(e) => setBedrooms(e.target.value)}
						className={inputClass}
					/>
				</FormField>
				<FormField label="Bathrooms">
					<input
						type="number"
						min="0"
						value={bathrooms}
						onChange={(e) => setBathrooms(e.target.value)}
						className={inputClass}
					/>
				</FormField>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<FormField label="Status">
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value as PropertyStatus)}
						className={inputClass}
					>
						<option value="vacant">Vacant</option>
						<option value="occupied">Occupied</option>
						<option value="sold">Sold</option>
					</select>
				</FormField>
				<FormField label={listing_type === "for_rent" ? "Monthly Rent" : "Sale Price"}>
					<input
						type="number"
						min="0"
						value={list_price}
						onChange={(e) => setListPrice(e.target.value)}
						className={inputClass}
						placeholder="0.00"
					/>
				</FormField>
				<FormField label="Currency">
					<input
						value={currency}
						onChange={(e) => setCurrency(e.target.value.toUpperCase())}
						className={inputClass}
						maxLength={4}
					/>
				</FormField>
			</div>

			<FormField label="Notes">
				<textarea
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					rows={3}
					className={inputClass}
				/>
			</FormField>

			{error && (
				<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
			)}

			<div className="flex items-center justify-between pt-2">
				{mode === "edit" ? (
					<button
						type="button"
						onClick={handleDelete}
						disabled={busy}
						className="text-xs text-red-600 hover:text-red-700 transition-colors disabled:opacity-40"
					>
						Delete property
					</button>
				) : <span />}

				<div className="flex gap-2">
					{onCancel && (
						<button
							type="button"
							onClick={onCancel}
							className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
						>
							Cancel
						</button>
					)}
					<button
						type="submit"
						disabled={busy}
						className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity disabled:opacity-50"
					>
						{busy ? "Saving…" : mode === "create" ? "Create property" : "Save changes"}
					</button>
				</div>
			</div>
		</form>
	);
}
