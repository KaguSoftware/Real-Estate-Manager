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
import { geocodeAddress } from "@/src/lib/geocode";
import { resolveAndParseMapsUrl, splitPlaceName } from "@/src/lib/maps-url";
import { MapPin, Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";

interface Props {
	mode: "create" | "edit";
	initial?: Property;
	onDone?: () => void;
	onCancel?: () => void;
}

/** Combine Turkish address parts into a single address_line string. */
function joinAddress(parts: {
	mahalle: string;
	street: string;
	buildingNo: string;
	apartmentNo: string;
	district: string;
}): string {
	const { mahalle, street, buildingNo, apartmentNo, district } = parts;
	const left: string[] = [];
	if (mahalle.trim())   left.push(`${mahalle.trim()} Mah.`);
	if (street.trim())    left.push(street.trim());
	const door: string[] = [];
	if (buildingNo.trim())   door.push(`No: ${buildingNo.trim()}`);
	if (apartmentNo.trim())  door.push(`Daire: ${apartmentNo.trim()}`);
	if (door.length) left.push(door.join(" "));
	if (district.trim()) left.push(district.trim());
	return left.join(", ");
}

export function PropertyForm({ mode, initial, onDone, onCancel }: Props) {
	const router = useRouter();
	const upsertProperty = useAppStore((s) => s.upsertProperty);
	const removeProperty = useAppStore((s) => s.removeProperty);

	const [homeowner_name, setHomeownerName] = useState(initial?.homeowner_name ?? "");

	// Turkish-style address fields. In edit mode we drop the existing joined
	// address into the "street" field so the user can re-fill or keep it.
	const [mahalle,     setMahalle]     = useState("");
	const [street,      setStreet]      = useState(initial?.address_line ?? "");
	const [buildingNo,  setBuildingNo]  = useState("");
	const [apartmentNo, setApartmentNo] = useState("");
	const [district,    setDistrict]    = useState("");
	const [city,        setCity]        = useState(initial?.city ?? "");

	const [size_sqm,     setSizeSqm]     = useState(initial?.size_sqm?.toString() ?? "");
	const [bedrooms,     setBedrooms]    = useState(initial?.bedrooms?.toString() ?? "");
	const [bathrooms,    setBathrooms]   = useState(initial?.bathrooms?.toString() ?? "");
	const [listing_type, setListingType] = useState<ListingType>(initial?.listing_type ?? "for_rent");
	const [status,       setStatus]      = useState<PropertyStatus>(initial?.status ?? "vacant");
	const [list_price,   setListPrice]   = useState(initial?.list_price?.toString() ?? "");
	const [currency,     setCurrency]    = useState(initial?.currency ?? "TRY");
	const [notes,        setNotes]       = useState(initial?.notes ?? "");

	// Turkish title-deed (tapu) fields — used by the sales agreement.
	const [nitelik,   setNitelik]   = useState(initial?.nitelik   ?? "");
	const [adaNo,     setAdaNo]     = useState(initial?.ada_no    ?? "");
	const [parselNo,  setParselNo]  = useState(initial?.parsel_no ?? "");
	const [tapuMahalle, setTapuMahalle] = useState(initial?.mahalle ?? "");
	const [mevkii,    setMevkii]    = useState(initial?.mevkii    ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Google Maps URL paste path. When set, parsedCoords short-circuits the
	// Nominatim fallback in handleSubmit.
	const [mapsUrl, setMapsUrl] = useState("");
	const [mapsBusy, setMapsBusy] = useState(false);
	const [mapsHint, setMapsHint] = useState<string | null>(null);
	const [parsedCoords, setParsedCoords] = useState<{ lat: number; lon: number } | null>(
		initial?.latitude != null && initial?.longitude != null
			? { lat: Number(initial.latitude), lon: Number(initial.longitude) }
			: null,
	);

	const addressPreview = joinAddress({ mahalle, street, buildingNo, apartmentNo, district });

	async function handleParseMapsUrl() {
		const url = mapsUrl.trim();
		if (!url) {
			setMapsHint(null);
			setParsedCoords(null);
			return;
		}
		setMapsBusy(true);
		setMapsHint("Parsing link…");
		try {
			const result = await resolveAndParseMapsUrl(url);
			if (result.lat != null && result.lon != null) {
				setParsedCoords({ lat: result.lat, lon: result.lon });
				setMapsHint(
					`Pinned at ${result.lat.toFixed(5)}, ${result.lon.toFixed(5)}` +
						(result.placeName ? ` · ${result.placeName}` : ""),
				);
			} else {
				setParsedCoords(null);
				setMapsHint(result.error ?? "Could not read this link.");
			}

			// Autofill empty fields only.
			if (result.placeName) {
				const parts = splitPlaceName(result.placeName);
				if (parts.mahalle && !mahalle.trim()) setMahalle(parts.mahalle);
				if (parts.street && !street.trim()) setStreet(parts.street);
				if (parts.buildingNo && !buildingNo.trim()) setBuildingNo(parts.buildingNo);
				if (parts.apartmentNo && !apartmentNo.trim()) setApartmentNo(parts.apartmentNo);
				if (parts.district && !district.trim()) setDistrict(parts.district);
				if (parts.city && !city.trim()) setCity(parts.city);
			}
		} finally {
			setMapsBusy(false);
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const joined = addressPreview;
		if (!joined) {
			setError("Address is required — fill in at least one of the address fields.");
			return;
		}

		setBusy(true);

		const input: PropertyInput = {
			homeowner_name: homeowner_name.trim(),
			address_line: joined,
			city: city.trim() || null,
			size_sqm: size_sqm.trim() ? Number(size_sqm) : null,
			bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
			bathrooms: bathrooms.trim() ? Number(bathrooms) : null,
			listing_type,
			status,
			list_price: list_price.trim() ? Number(list_price) : null,
			currency,
			notes: notes.trim() || null,
			nitelik:   nitelik.trim()      || null,
			ada_no:    adaNo.trim()        || null,
			parsel_no: parselNo.trim()     || null,
			mahalle:   tapuMahalle.trim()  || null,
			mevkii:    mevkii.trim()       || null,
		};

		// Coordinates: prefer a pasted Google Maps URL (precise, user-confirmed).
		// Otherwise fall back to Nominatim with the address-section mahalle —
		// `tapuMahalle` is the title-deed value, often blank and not the one in
		// the joined address.
		let geocodeMissed = false;
		if (parsedCoords) {
			input.latitude = parsedCoords.lat;
			input.longitude = parsedCoords.lon;
		} else {
			const geo = await geocodeAddress({
				address_line: joined,
				mahalle: mahalle.trim() || tapuMahalle.trim() || null,
				mevkii: input.mevkii,
				city: input.city,
			});
			if (geo) {
				input.latitude = geo.lat;
				input.longitude = geo.lon;
			} else {
				geocodeMissed = true;
				if (mode === "create") {
					input.latitude = null;
					input.longitude = null;
				}
				// In edit mode, leave latitude/longitude unset on the input so
				// the existing coords on the row are preserved.
			}
		}

		try {
			const row =
				mode === "create"
					? await createProperty(input)
					: await updateProperty(initial!.id, input);
			upsertProperty(row);
			if (geocodeMissed && row.latitude == null) {
				// Surface a hint in this form for edit mode (user is staying here);
				// on create the user lands on the detail page where the banner shows.
				setMapsHint(
					"Saved without coordinates — Nominatim couldn't find this address. " +
						"Paste a Google Maps link above and re-save to put this property on the map.",
				);
			}
			if (mode === "create") {
				router.push(`/properties/${row.id}`);
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
			router.push("/");
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
						placeholder="Ahmet Yılmaz"
					/>
				</FormField>
				<FormField label="Listing Type">
					<select
						value={listing_type}
						onChange={(e) => setListingType(e.target.value as ListingType)}
						className={inputClass}
					>
						<option value="for_rent">For Rent (Kiralık)</option>
						<option value="for_sale">For Sale (Satılık)</option>
					</select>
				</FormField>
			</div>

			{/* Address — Turkish parts */}
			<div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
				<p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Address</p>

				{/* Google Maps link — paste to extract coords + autofill empty fields. */}
				<FormField label="Google Maps link (optional)">
					<div className="flex gap-2">
						<input
							type="url"
							value={mapsUrl}
							onChange={(e) => {
								setMapsUrl(e.target.value);
								// Editing the URL invalidates previously parsed coords until re-parse.
								if (parsedCoords) setParsedCoords(null);
								if (mapsHint) setMapsHint(null);
							}}
							onPaste={(e) => {
								const pasted = e.clipboardData.getData("text");
								if (pasted) {
									setMapsUrl(pasted);
									// Defer to next tick so state has applied before parse runs.
									setTimeout(() => { void handleParseMapsUrl(); }, 0);
									e.preventDefault();
								}
							}}
							onBlur={() => { if (mapsUrl.trim() && !parsedCoords) void handleParseMapsUrl(); }}
							className={inputClass}
							placeholder="https://maps.app.goo.gl/… or https://www.google.com/maps/place/…"
						/>
						<button
							type="button"
							onClick={handleParseMapsUrl}
							disabled={mapsBusy || !mapsUrl.trim()}
							className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-40 whitespace-nowrap inline-flex items-center gap-1.5"
						>
							{mapsBusy ? (
								<Loader2 className="w-3.5 h-3.5 animate-spin" />
							) : (
								<MapPin className="w-3.5 h-3.5" />
							)}
							Parse
						</button>
					</div>
					{mapsHint && (
						<p className={`mt-1 text-[11px] inline-flex items-center gap-1 ${parsedCoords ? "text-emerald-700" : "text-amber-700"}`}>
							{parsedCoords ? (
								<CheckCircle2 className="w-3 h-3 shrink-0" />
							) : (
								<AlertTriangle className="w-3 h-3 shrink-0" />
							)}
							<span>{mapsHint}</span>
						</p>
					)}
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Mahalle (Neighborhood)">
						<input
							value={mahalle}
							onChange={(e) => setMahalle(e.target.value)}
							className={inputClass}
							placeholder="Atatürk"
						/>
					</FormField>
					<FormField label="Sokak / Cadde (Street)">
						<input
							value={street}
							onChange={(e) => setStreet(e.target.value)}
							className={inputClass}
							placeholder="Cumhuriyet Cd."
						/>
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<FormField label="Bina No">
						<input
							value={buildingNo}
							onChange={(e) => setBuildingNo(e.target.value)}
							className={inputClass}
							placeholder="42"
						/>
					</FormField>
					<FormField label="Daire">
						<input
							value={apartmentNo}
							onChange={(e) => setApartmentNo(e.target.value)}
							className={inputClass}
							placeholder="8"
						/>
					</FormField>
					<FormField label="İlçe (District)">
						<input
							value={district}
							onChange={(e) => setDistrict(e.target.value)}
							className={inputClass}
							placeholder="Kadıköy"
						/>
					</FormField>
					<FormField label="İl (City)">
						<input
							value={city}
							onChange={(e) => setCity(e.target.value)}
							className={inputClass}
							placeholder="İstanbul"
						/>
					</FormField>
				</div>

				{addressPreview && (
					<p className="text-[11px] text-slate-500">
						<span className="font-bold uppercase tracking-wider text-[9px] text-slate-400 mr-2">Preview</span>
						{addressPreview}{city ? `, ${city}` : ""}
					</p>
				)}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
					<select
						value={currency}
						onChange={(e) => setCurrency(e.target.value)}
						className={inputClass}
					>
						<option value="TRY">TRY (₺)</option>
						<option value="USD">USD ($)</option>
						<option value="EUR">EUR (€)</option>
					</select>
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

			{/* Tapu Bilgileri (title deed) — used by the sales agreement PDF. */}
			<div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
				<div>
					<p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tapu Bilgileri</p>
					<p className="text-[11px] text-slate-400 mt-0.5">Title deed details — populated into the Sales Agreement PDF (optional).</p>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<FormField label="Niteliği (Type/Kind)">
						<input value={nitelik} onChange={(e) => setNitelik(e.target.value)} className={inputClass} placeholder="Mesken" />
					</FormField>
					<FormField label="Ada No">
						<input value={adaNo} onChange={(e) => setAdaNo(e.target.value)} className={inputClass} />
					</FormField>
					<FormField label="Parsel No">
						<input value={parselNo} onChange={(e) => setParselNo(e.target.value)} className={inputClass} />
					</FormField>
					<FormField label="Mevkii">
						<input value={mevkii} onChange={(e) => setMevkii(e.target.value)} className={inputClass} />
					</FormField>
				</div>
				<FormField label="Mahalle (per tapu)">
					<input value={tapuMahalle} onChange={(e) => setTapuMahalle(e.target.value)} className={inputClass} placeholder="As written on the title deed" />
				</FormField>
			</div>

			{error && (
				<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
			)}

			<div className="flex items-center justify-between pt-2">
				{mode === "edit" ? (
					<button
						type="button"
						onClick={handleDelete}
						disabled={busy}
						className="text-xs text-red-600 hover:text-red-700 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
					>
						<Trash2 className="w-3.5 h-3.5" />
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
