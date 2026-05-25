"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";
import { listEligiblePropertiesForDocType, updateProperty } from "@/src/lib/db/properties";
import { createTenant } from "@/src/lib/db/tenants";
import { createLease, computeLeaseEndDate } from "@/src/lib/db/leases";
import { exportToPDF } from "@/src/lib/pdf";
import type { DocKind, RentalPDFData } from "@/src/lib/pdf";
import { PDFDocument } from "@/src/lib/pdf";
import type { Property, LeaseTerm } from "@/src/lib/db/types";
import { PropertyPickerCardList } from "./PropertyPickerCardList";
import { FormField, inputClass } from "@/src/components/ui/FormField";

// Lazy-loaded BlobProvider from @react-pdf/renderer. We embed the blob URL
// in an iframe — more reliable across browsers than PDFViewer's built-in
// canvas renderer, which can fall back to the "PDF attachment" download UI.
const PDFBlobProvider = dynamic(
	() => import("@react-pdf/renderer").then((m) => m.BlobProvider),
	{ ssr: false, loading: () => <div className="text-xs text-slate-400 p-6">Loading preview…</div> },
);

type Step = "type" | "property" | "details" | "preview";

const todayISO = () => new Date().toISOString().slice(0, 10);

function safeFilename(s: string) {
	return s.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
}

function buildRentalPDFData(args: {
	property: Property;
	tenant: { full_name: string; email: string | null; phone: string | null; national_id: string | null };
	term: LeaseTerm;
	startDate: string;
	monthlyRent: number;
	deposit: number;
	currency: string;
	additionalClauses: string;
}): RentalPDFData {
	return {
		property: {
			homeowner_name: args.property.homeowner_name,
			address_line: args.property.address_line,
			city: args.property.city,
			size_sqm: args.property.size_sqm,
		},
		tenant: args.tenant,
		lease: {
			term: args.term,
			start_date: args.startDate,
			end_date: computeLeaseEndDate(args.startDate, args.term),
			monthly_rent: args.monthlyRent,
			deposit: args.deposit,
			currency: args.currency,
		},
		additionalClauses: args.additionalClauses || undefined,
		generatedAt: new Date().toISOString(),
	};
}

export function DocumentWizard() {
	const router = useRouter();
	const upsertProperty = useAppStore((s) => s.upsertProperty);
	const selectProperty = useAppStore((s) => s.selectProperty);

	const [step, setStep] = useState<Step>("type");
	const [kind, setKind] = useState<DocKind>("rental");

	// Step 2 state
	const [properties, setProperties] = useState<Property[]>([]);
	const [loadingProperties, setLoadingProperties] = useState(false);
	const [propertyId, setPropertyId] = useState<string | null>(null);
	const property = useMemo(
		() => properties.find((p) => p.id === propertyId) ?? null,
		[properties, propertyId],
	);

	// Step 3 state
	const [tenantName, setTenantName] = useState("");
	const [tenantEmail, setTenantEmail] = useState("");
	const [tenantPhone, setTenantPhone] = useState("");
	const [tenantNationalId, setTenantNationalId] = useState("");
	const [term, setTerm] = useState<LeaseTerm>("1yr");
	const [startDate, setStartDate] = useState(todayISO());
	const [monthlyRent, setMonthlyRent] = useState("");
	const [deposit, setDeposit] = useState("0");
	const [currency, setCurrency] = useState("TRY");
	const [additionalClauses, setAdditionalClauses] = useState("");

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load eligible properties whenever we enter step 2.
	useEffect(() => {
		if (step !== "property") return;
		setLoadingProperties(true);
		setError(null);
		listEligiblePropertiesForDocType(kind)
			.then(setProperties)
			.catch((e) => setError(e instanceof Error ? e.message : String(e)))
			.finally(() => setLoadingProperties(false));
	}, [step, kind]);

	// When property is chosen, prefill currency and monthly rent.
	useEffect(() => {
		if (property) {
			setCurrency(property.currency);
			if (property.list_price != null && monthlyRent === "") {
				setMonthlyRent(property.list_price.toString());
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [property]);

	const rentalData = useMemo<RentalPDFData | null>(() => {
		if (step !== "preview" || !property) return null;
		return buildRentalPDFData({
			property,
			tenant: {
				full_name: tenantName.trim(),
				email: tenantEmail.trim() || null,
				phone: tenantPhone.trim() || null,
				national_id: tenantNationalId.trim() || null,
			},
			term,
			startDate,
			monthlyRent: Number(monthlyRent || 0),
			deposit: Number(deposit || 0),
			currency,
			additionalClauses,
		});
	}, [step, property, tenantName, tenantEmail, tenantPhone, tenantNationalId, term, startDate, monthlyRent, deposit, currency, additionalClauses]);

	async function handleConfirm() {
		if (!property || !rentalData) return;
		setSubmitting(true);
		setError(null);
		try {
			const tenant = await createTenant({
				full_name: tenantName.trim(),
				email: tenantEmail.trim() || null,
				phone: tenantPhone.trim() || null,
				national_id: tenantNationalId.trim() || null,
			});

			await createLease({
				property_id: property.id,
				tenant_id: tenant.id,
				term,
				start_date: startDate,
				end_date: computeLeaseEndDate(startDate, term),
				monthly_rent: Number(monthlyRent || 0),
				deposit: Number(deposit || 0),
				currency,
			});

			const updated = await updateProperty(property.id, { status: "occupied" });
			upsertProperty(updated);

			const filename = `rental-${safeFilename(tenant.full_name)}-${safeFilename(property.address_line)}.pdf`;
			await exportToPDF("rental", rentalData, filename);

			selectProperty(updated.id);
			router.push("/");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSubmitting(false);
		}
	}

	const detailsValid =
		!!property &&
		tenantName.trim().length > 0 &&
		(tenantEmail.trim().length > 0 || tenantPhone.trim().length > 0) &&
		Number(monthlyRent) > 0 &&
		startDate.length === 10;

	return (
		<div className="max-w-4xl mx-auto px-6 py-8">
			{/* Stepper */}
			<ol className="flex items-center gap-2 mb-8 text-[11px] font-bold uppercase tracking-widest">
				{(["type", "property", "details", "preview"] as Step[]).map((s, i) => (
					<li key={s} className="flex items-center gap-2">
						<span
							className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
								step === s
									? "bg-primary text-primary-content"
									: i < (["type","property","details","preview"] as Step[]).indexOf(step)
										? "bg-emerald-500 text-white"
										: "bg-slate-200 text-slate-500"
							}`}
						>{i + 1}</span>
						<span className={step === s ? "text-slate-900" : "text-slate-400"}>{s}</span>
						{i < 3 && <span className="text-slate-300">›</span>}
					</li>
				))}
			</ol>

			{error && (
				<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
			)}

			{/* Step 1: type */}
			{step === "type" && (
				<div className="space-y-4">
					<h2 className="text-base font-bold text-slate-900">Choose a document type</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<button
							onClick={() => { setKind("rental"); setStep("property"); }}
							className="text-left p-5 rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors"
						>
							<p className="text-sm font-bold text-slate-900">Rental Agreement</p>
							<p className="text-xs text-slate-500 mt-1">Lease a vacant for-rent property to a new tenant.</p>
						</button>
						<div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
							<p className="text-sm font-bold text-slate-900">Sales Agreement</p>
							<p className="text-xs text-slate-500 mt-1">Coming soon.</p>
						</div>
						<div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
							<p className="text-sm font-bold text-slate-900">Rent Receipt</p>
							<p className="text-xs text-slate-500 mt-1">Coming soon.</p>
						</div>
					</div>
				</div>
			)}

			{/* Step 2: property */}
			{step === "property" && (
				<div className="space-y-4">
					<h2 className="text-base font-bold text-slate-900">Pick a property</h2>
					{loadingProperties ? (
						<div className="flex justify-center py-8">
							<span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
						</div>
					) : (
						<PropertyPickerCardList
							properties={properties}
							selectedId={propertyId}
							onSelect={setPropertyId}
							emptyHint="The rental wizard only lists for-rent properties that are currently vacant."
						/>
					)}
					<div className="flex justify-between pt-4">
						<button onClick={() => setStep("type")} className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">← Back</button>
						<button
							onClick={() => setStep("details")}
							disabled={!propertyId}
							className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 disabled:opacity-40"
						>Continue →</button>
					</div>
				</div>
			)}

			{/* Step 3: details */}
			{step === "details" && property && (
				<div className="space-y-5">
					<div>
						<h2 className="text-base font-bold text-slate-900">Rental details</h2>
						<p className="text-xs text-slate-500 mt-1">{property.address_line}{property.city ? `, ${property.city}` : ""}</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Tenant name">
							<input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} required />
						</FormField>
						<FormField label="National ID (optional)">
							<input value={tenantNationalId} onChange={(e) => setTenantNationalId(e.target.value)} className={inputClass} />
						</FormField>
						<FormField label="Tenant email">
							<input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} className={inputClass} />
						</FormField>
						<FormField label="Tenant phone">
							<input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputClass} />
						</FormField>
					</div>
					<p className="text-[11px] text-slate-400 -mt-3">Provide at least an email or phone for the tenant.</p>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<FormField label="Term">
							<select value={term} onChange={(e) => setTerm(e.target.value as LeaseTerm)} className={inputClass}>
								<option value="1yr">1 year</option>
								<option value="2yr">2 years</option>
								<option value="undefined">Undefined</option>
							</select>
						</FormField>
						<FormField label="Start date">
							<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
						</FormField>
						<FormField label="Currency">
							<input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass} maxLength={4} />
						</FormField>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Monthly rent">
							<input type="number" min="0" step="0.01" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className={inputClass} required />
						</FormField>
						<FormField label="Security deposit">
							<input type="number" min="0" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputClass} />
						</FormField>
					</div>

					<FormField label="Additional clauses (optional)">
						<textarea
							value={additionalClauses}
							onChange={(e) => setAdditionalClauses(e.target.value)}
							rows={4}
							className={inputClass}
							placeholder="Any extra terms specific to this lease…"
						/>
					</FormField>

					<div className="flex justify-between pt-4">
						<button onClick={() => setStep("property")} className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">← Back</button>
						<button
							onClick={() => setStep("preview")}
							disabled={!detailsValid}
							className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 disabled:opacity-40"
						>Preview →</button>
					</div>
				</div>
			)}

			{/* Step 4: preview */}
			{step === "preview" && rentalData && (
				<div className="space-y-4">
					<h2 className="text-base font-bold text-slate-900">Review & generate</h2>
					<div className="h-[75vh] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
						<PDFBlobProvider document={<PDFDocument kind="rental" data={rentalData} />}>
							{({ url, loading, error: blobError }) => {
								if (loading || !url) {
									return (
										<div className="h-full flex items-center justify-center">
											<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
										</div>
									);
								}
								if (blobError) {
									return (
										<div className="h-full flex items-center justify-center text-xs text-red-600 p-6">
											Preview failed to render: {String(blobError)}
										</div>
									);
								}
								return (
									<iframe
										src={`${url}#toolbar=0&navpanes=0`}
										className="w-full h-full border-0"
										title="Rental agreement preview"
									/>
								);
							}}
						</PDFBlobProvider>
					</div>
					<div className="flex justify-between pt-2">
						<button
							onClick={() => setStep("details")}
							disabled={submitting}
							className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
						>← Back</button>
						<button
							onClick={handleConfirm}
							disabled={submitting}
							className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
						>{submitting ? "Generating…" : "Confirm & generate PDF"}</button>
					</div>
				</div>
			)}
		</div>
	);
}
