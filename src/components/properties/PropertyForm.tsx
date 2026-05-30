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
import { FormField, Input, Textarea, Select, Button } from "@/src/components/ui";
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
					<Input required value={homeowner_name} onChange={(e) => setHomeownerName(e.target.value)} placeholder="Ahmet Yılmaz" />
				</FormField>
				<FormField label="Listing Type">
					<Select value={listing_type} onChange={(e) => setListingType(e.target.value as ListingType)}>
						<option value="for_rent">For Rent (Kiralık)</option>
						<option value="for_sale">For Sale (Satılık)</option>
					</Select>
				</FormField>
			</div>

			{/* Address — Turkish parts */}
			<div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
				<p className="text-xs font-bold uppercase tracking-wider text-slate-500">Address</p>

				{/* Google Maps link — paste to extract coords + autofill empty fields. */}
				<FormField label="Google Maps link (optional)">
					<div className="flex flex-col sm:flex-row gap-2">
						<Input
							type="url"
							value={mapsUrl}
							onChange={(e) => {
								setMapsUrl(e.target.value);
								if (parsedCoords) setParsedCoords(null);
								if (mapsHint) setMapsHint(null);
							}}
							onPaste={(e) => {
								const pasted = e.clipboardData.getData("text");
								if (pasted) {
									setMapsUrl(pasted);
									setTimeout(() => { void handleParseMapsUrl(); }, 0);
									e.preventDefault();
								}
							}}
							onBlur={() => { if (mapsUrl.trim() && !parsedCoords) void handleParseMapsUrl(); }}
							placeholder="https://maps.app.goo.gl/…"
						/>
						<Button
							type="button"
							variant="secondary"
							onClick={handleParseMapsUrl}
							disabled={mapsBusy || !mapsUrl.trim()}
							className="shrink-0"
						>
							{mapsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
							Parse
						</Button>
					</div>
					{mapsHint && (
						<p className={`mt-1.5 text-xs inline-flex items-center gap-1 ${parsedCoords ? "text-emerald-700" : "text-amber-700"}`}>
							{parsedCoords ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
							<span>{mapsHint}</span>
						</p>
					)}
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Mahalle (Neighborhood)">
						<Input value={mahalle} onChange={(e) => setMahalle(e.target.value)} placeholder="Atatürk" />
					</FormField>
					<FormField label="Sokak / Cadde (Street)">
						<Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Cumhuriyet Cd." />
					</FormField>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
					<FormField label="Bina No">
						<Input value={buildingNo} onChange={(e) => setBuildingNo(e.target.value)} placeholder="42" />
					</FormField>
					<FormField label="Daire">
						<Input value={apartmentNo} onChange={(e) => setApartmentNo(e.target.value)} placeholder="8" />
					</FormField>
					<FormField label="İlçe (District)">
						<Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Kadıköy" />
					</FormField>
					<FormField label="İl (City)">
						<Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" />
					</FormField>
				</div>

				{addressPreview && (
					<p className="text-xs text-slate-500">
						<span className="font-bold uppercase tracking-wider text-slate-400 mr-2">Preview</span>
						{addressPreview}{city ? `, ${city}` : ""}
					</p>
				)}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<FormField label="Size (m²)">
					<Input type="number" inputMode="numeric" min="0" value={size_sqm} onChange={(e) => setSizeSqm(e.target.value)} />
				</FormField>
				<FormField label="Bedrooms">
					<Input type="number" inputMode="numeric" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
				</FormField>
				<FormField label="Bathrooms">
					<Input type="number" inputMode="numeric" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
				</FormField>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<FormField label="Status">
					<Select value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus)}>
						<option value="vacant">Vacant</option>
						<option value="occupied">Occupied</option>
						<option value="sold">Sold</option>
					</Select>
				</FormField>
				<FormField label={listing_type === "for_rent" ? "Monthly Rent" : "Sale Price"}>
					<Input type="number" inputMode="decimal" min="0" value={list_price} onChange={(e) => setListPrice(e.target.value)} placeholder="0.00" />
				</FormField>
				<FormField label="Currency">
					<Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
						<option value="TRY">TRY (₺)</option>
						<option value="USD">USD ($)</option>
						<option value="EUR">EUR (€)</option>
					</Select>
				</FormField>
			</div>

			<FormField label="Notes">
				<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
			</FormField>

			{/* Tapu Bilgileri (title deed) — used by the sales agreement PDF. */}
			<div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
				<div>
					<p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tapu Bilgileri</p>
					<p className="text-xs text-slate-400 mt-0.5">Title deed details — populated into the Sales Agreement PDF (optional).</p>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
					<FormField label="Niteliği (Type/Kind)">
						<Input value={nitelik} onChange={(e) => setNitelik(e.target.value)} placeholder="Mesken" />
					</FormField>
					<FormField label="Ada No">
						<Input value={adaNo} onChange={(e) => setAdaNo(e.target.value)} />
					</FormField>
					<FormField label="Parsel No">
						<Input value={parselNo} onChange={(e) => setParselNo(e.target.value)} />
					</FormField>
					<FormField label="Mevkii">
						<Input value={mevkii} onChange={(e) => setMevkii(e.target.value)} />
					</FormField>
				</div>
				<FormField label="Mahalle (per tapu)">
					<Input value={tapuMahalle} onChange={(e) => setTapuMahalle(e.target.value)} placeholder="As written on the title deed" />
				</FormField>
			</div>

			{error && (
				<div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
			)}

			<div className="flex items-center justify-between gap-2 pt-2">
				{mode === "edit" ? (
					<Button type="button" variant="danger" size="md" onClick={handleDelete} disabled={busy} aria-label="Delete property">
						<Trash2 className="w-4 h-4" />
						<span className="hidden sm:inline">Delete</span>
					</Button>
				) : <span />}

				<div className="flex gap-2">
					{onCancel && (
						<Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
					)}
					<Button type="submit" loading={busy}>
						{mode === "create" ? "Create property" : "Save changes"}
					</Button>
				</div>
			</div>
		</form>
	);
}
