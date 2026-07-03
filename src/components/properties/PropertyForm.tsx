"use client";

import { humanizeError } from "@/src/lib/errors";
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
import { FormField, Input, Textarea, Select, Button, Alert, ConfirmDialog, toast } from "@/src/components/ui";
import type { ReverseAddress } from "@/src/lib/geocode";
import { splitPlaceName, type ResolveResult } from "@/src/lib/maps-url";
import { LocationPicker, type LatLon } from "./LocationPicker";
import { Trash2 } from "lucide-react";

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

/** A flat set of address fields a maps link can fill. Empty values are omitted. */
interface MapsFields {
	mahalle?: string;
	street?: string;
	buildingNo?: string;
	apartmentNo?: string;
	district?: string;
	city?: string;
	mevkii?: string;
}

/**
 * Merge reverse-geocode address parts (preferred for road/neighbourhood/city)
 * with the slug-derived split (door numbers, fallbacks). For non-Turkish
 * addresses we keep generic road/city mapping and skip the Turkish mahalle/mevkii
 * mirroring. Returns only non-empty fields.
 */
function mapsToFormFields(result: ResolveResult): MapsFields {
	const a = result.address;
	const slug = result.placeName ? splitPlaceName(result.placeName) : {};
	const isTR = !a?.country_code || a.country_code.toLowerCase() === "tr";

	const out: MapsFields = {};
	const set = (k: keyof MapsFields, ...vals: (string | undefined)[]) => {
		const v = vals.find((x) => x && x.trim());
		if (v) out[k] = v.trim();
	};

	const rCity = a?.province || a?.city || a?.state || a?.town;
	const rDistrict = [a?.county, a?.district, a?.town].find((d) => d && d !== rCity);
	const rMahalle = a?.neighbourhood || a?.quarter || a?.suburb;

	set("street", a?.road, slug.street);
	set("buildingNo", a?.house_number, slug.buildingNo);
	set("apartmentNo", slug.apartmentNo);
	set("city", rCity, slug.city);
	set("district", rDistrict, slug.district);

	if (isTR) {
		set("mahalle", rMahalle, slug.mahalle);
		// mevkii: a leftover locality not already used as the mahalle.
		const leftover = [a?.suburb, a?.quarter].find((s) => s && s !== out.mahalle);
		set("mevkii", leftover);
	} else {
		set("mahalle", slug.mahalle);
	}

	return out;
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
	// "" = unknown, "yes" = furnished, "no" = unfurnished.
	const [furnished,    setFurnished]   = useState(initial?.furnished == null ? "" : initial.furnished ? "yes" : "no");
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
	const [locating, setLocating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	// Pin coordinates — set from a maps link, a map tap/drag, or the eager
	// geocode that runs at save time when the pin is still empty.
	const [coords, setCoords] = useState<LatLon | null>(
		initial?.latitude != null && initial?.longitude != null
			? { lat: Number(initial.latitude), lon: Number(initial.longitude) }
			: null,
	);

	const addressPreview = joinAddress({ mahalle, street, buildingNo, apartmentNo, district });

	/** Fill empty address fields from a reverse-geocoded/parsed result. */
	function autofillAddress(result: ResolveResult) {
		const f = mapsToFormFields(result);
		const fill = (val: string | undefined, current: string, setter: (v: string) => void) => {
			if (val && !current.trim()) setter(val);
		};
		fill(f.mahalle, mahalle, setMahalle);
		fill(f.street, street, setStreet);
		fill(f.buildingNo, buildingNo, setBuildingNo);
		fill(f.apartmentNo, apartmentNo, setApartmentNo);
		fill(f.district, district, setDistrict);
		fill(f.city, city, setCity);
		// Mirror into the tapu section where it's still blank.
		fill(f.mahalle, tapuMahalle, setTapuMahalle);
		fill(f.mevkii, mevkii, setMevkii);
	}

	function handleLocationChange(next: LatLon | null, address?: ReverseAddress | null) {
		setCoords(next);
		if (next && address) autofillAddress({ lat: next.lat, lon: next.lon, address });
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
			furnished: furnished === "" ? null : furnished === "yes",
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

		// Coordinates: prefer the pin (maps link / map tap — precise and
		// user-confirmed). Otherwise geocode the typed address eagerly, with
		// visible progress, so the user sees the outcome instead of a silent miss.
		let geocodeMissed = false;
		if (coords) {
			input.latitude = coords.lat;
			input.longitude = coords.lon;
		} else {
			setLocating(true);
			const geo = await (async () => {
				try {
					const params = new URLSearchParams({ q: joined });
					const m = mahalle.trim() || tapuMahalle.trim();
					if (m) params.set("mahalle", m);
					if (input.mevkii) params.set("mevkii", input.mevkii);
					if (input.city) params.set("city", input.city);
					const res = await fetch(`/api/geocode?${params}`);
					if (!res.ok) return null;
					return (await res.json()) as { lat: number; lon: number };
				} catch {
					return null;
				}
			})();
			setLocating(false);
			if (geo) {
				input.latitude = geo.lat;
				input.longitude = geo.lon;
				// Drop the pin so the user sees where the address landed.
				setCoords({ lat: geo.lat, lon: geo.lon });
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
				toast.info("Saved without a map location — set the pin on the map to place this property.");
			} else {
				toast.success(mode === "create" ? "Property created." : "Property updated.");
			}
			if (mode === "create") {
				router.push(`/properties/${row.id}`);
			}
			onDone?.();
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		setBusy(true);
		try {
			await deleteProperty(initial.id);
			removeProperty(initial.id);
			toast.success("Property deleted.");
			router.push("/properties");
			onDone?.();
		} catch (e) {
			setConfirmingDelete(false);
			setError(humanizeError(e));
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

				{/* Location — paste a maps link or tap/drag the pin. Reverse-geocoded
				    address parts autofill the empty fields below. */}
				<LocationPicker value={coords} onChange={handleLocationChange} />

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

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
				<FormField label="Size (m²)">
					<Input type="number" inputMode="numeric" min="0" value={size_sqm} onChange={(e) => setSizeSqm(e.target.value)} />
				</FormField>
				<FormField label="Bedrooms">
					<Input type="number" inputMode="numeric" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
				</FormField>
				<FormField label="Bathrooms">
					<Input type="number" inputMode="numeric" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
				</FormField>
				<FormField label="Furnished">
					<Select value={furnished} onChange={(e) => setFurnished(e.target.value)}>
						<option value="">Not specified</option>
						<option value="yes">Furnished</option>
						<option value="no">Unfurnished</option>
					</Select>
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

			{error && <Alert>{error}</Alert>}

			<div className="flex items-center justify-between gap-2 pt-2">
				{mode === "edit" ? (
					<Button type="button" variant="danger" size="md" onClick={() => setConfirmingDelete(true)} disabled={busy} aria-label="Delete property">
						<Trash2 className="w-4 h-4" />
						<span className="hidden sm:inline">Delete</span>
					</Button>
				) : <span />}

				<div className="flex gap-2">
					{onCancel && (
						<Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
					)}
					<Button type="submit" loading={busy}>
						{locating
							? "Locating address…"
							: mode === "create" ? "Create property" : "Save changes"}
					</Button>
				</div>
			</div>

			<ConfirmDialog
				open={confirmingDelete}
				title="Delete this property?"
				message={initial ? `"${initial.address_line}" and its photos, leases and payment history will be removed. This cannot be undone.` : undefined}
				confirmLabel="Delete property"
				loading={busy}
				onConfirm={handleDelete}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</form>
	);
}
