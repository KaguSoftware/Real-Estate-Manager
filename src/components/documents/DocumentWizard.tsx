"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";
import { listEligiblePropertiesForDocType, updateProperty } from "@/src/lib/db/properties";
import { listLeads } from "@/src/lib/db/leads";
import { createTenant } from "@/src/lib/db/tenants";
import { createLease, computeLeaseEndDate } from "@/src/lib/db/leases";
import { createSale } from "@/src/lib/db/sales";
import { exportToPDF } from "@/src/lib/pdf";
import type { DocKind, RentalPDFData, SalesPDFData } from "@/src/lib/pdf";
import { PDFDocument } from "@/src/lib/pdf";
import type { Property, Lead } from "@/src/lib/db/types";
import { PropertyPickerCardList } from "./PropertyPickerCardList";
import { ClientPickerCardList } from "./ClientPickerCardList";
import { Button, cn, Alert, Spinner, toast } from "@/src/components/ui";
import { invalidateCache } from "@/src/lib/useCachedResource";
import {
	SalesDetailsForm,
	initialSalesFormState,
	computeCommission,
	validateSales,
	type SalesFormState,
} from "./SalesDetailsForm";
import {
	RentalDetailsForm,
	initialRentalFormState,
	validateRental,
	type RentalFormState,
} from "./RentalDetailsForm";

const PDFBlobProvider = dynamic(
	() => import("@react-pdf/renderer").then((m) => m.BlobProvider),
	{ ssr: false, loading: () => <div className="text-sm text-slate-400 p-6">Loading preview…</div> },
);

type Step = "type" | "property" | "client" | "details" | "preview";

const STEPS: Step[] = ["type", "property", "client", "details", "preview"];

function safeFilename(s: string) {
	return s.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
}

function buildRentalPDFData(property: Property, s: RentalFormState): RentalPDFData {
	const paymentDay = s.paymentDay ? Number(s.paymentDay) : null;
	return {
		landlord: {
			full_name: s.landlordName.trim(),
			address: s.landlordAddress.trim(),
			national_id: s.landlordNationalId.trim() || null,
			tax_no: s.landlordTaxNo.trim() || null,
			tax_office: s.landlordTaxOffice.trim() || null,
			phone: s.landlordPhone.trim() || null,
			email: s.landlordEmail.trim() || null,
		},
		tenant: {
			full_name: s.tenantName.trim(),
			address: s.tenantAddress.trim(),
			national_id: s.tenantNationalId.trim() || null,
			tax_no: s.tenantTaxNo.trim() || null,
			tax_office: s.tenantTaxOffice.trim() || null,
			phone: s.tenantPhone.trim() || null,
			email: s.tenantEmail.trim() || null,
		},
		guarantor:
			s.guarantorEnabled && s.guarantorName.trim()
				? {
						full_name: s.guarantorName.trim(),
						address: s.guarantorAddress.trim(),
						national_id: s.guarantorNationalId.trim() || null,
						tax_no: null,
						tax_office: null,
						phone: s.guarantorPhone.trim() || null,
						email: s.guarantorEmail.trim() || null,
					}
				: null,
		property: {
			address: [property.address_line, property.city].filter(Boolean).join(", "),
			nitelik: property.nitelik,
			size_sqm: property.size_sqm,
			city: property.city,
			floor: null,
			unit_no: null,
		},
		lease: {
			term: s.term,
			start_date: s.startDate,
			end_date: computeLeaseEndDate(s.startDate, s.term),
			monthly_rent: Number(s.monthlyRent || 0),
			deposit: Number(s.deposit || 0),
			currency: s.currency,
			payment_day: paymentDay,
			payment_method: s.paymentMethod.trim() || null,
			bank_account: s.bankAccount.trim() || null,
		},
		utilities: {
			electricity: s.utilElectricity,
			water: s.utilWater,
			gas: s.utilGas,
			internet: s.utilInternet,
			aidat: s.utilAidat,
		},
		subletting_allowed: s.sublettingAllowed,
		rent_increase_note: s.rentIncreaseNote.trim() || null,
		inventory: s.inventory.filter((r) => r.item.trim()),
		condition_notes: s.conditionNotes.trim() || null,
		special_conditions: s.specialConditions.trim() || null,
		generatedAt: new Date().toISOString(),
	};
}

function buildSalesPDFData(property: Property, s: SalesFormState): SalesPDFData {
	const salePrice = Number(s.salePrice || 0);
	return {
		seller: {
			full_name: s.sellerName.trim(),
			address: s.sellerAddress.trim(),
			national_id: s.sellerNationalId.trim() || null,
			tax_no: s.sellerTaxNo.trim() || null,
			tax_office: s.sellerTaxOffice.trim() || null,
			phone: s.sellerPhone.trim() || null,
			email: s.sellerEmail.trim() || null,
		},
		buyer: {
			full_name: s.buyerName.trim(),
			address: s.buyerAddress.trim(),
			national_id: s.buyerNationalId.trim() || null,
			tax_no: s.buyerTaxNo.trim() || null,
			tax_office: s.buyerTaxOffice.trim() || null,
			phone: s.buyerPhone.trim() || null,
			email: s.buyerEmail.trim() || null,
		},
		property: {
			address: [property.address_line, property.city].filter(Boolean).join(", "),
			nitelik: property.nitelik,
			yuz_olcumu: property.size_sqm != null ? String(property.size_sqm) : null,
			durum: property.status,
			ada_no: property.ada_no,
			parsel_no: property.parsel_no,
			mahalle: property.mahalle,
			mevkii: property.mevkii,
		},
		sale: {
			sale_price: salePrice,
			currency: s.currency,
			sale_date: s.saleDate,
			target_close_date: s.targetCloseDate || null,
			deposit_amount: s.depositAmount ? Number(s.depositAmount) : null,
			penalty_amount: s.penaltyAmount ? Number(s.penaltyAmount) : null,
			validity_days: s.validityDays ? Number(s.validityDays) : null,
			tax_responsibility: s.taxResponsibility,
		},
		commission: {
			buyer:  computeCommission(salePrice, s.buyerCommissionRate  ? Number(s.buyerCommissionRate)  : null),
			seller: computeCommission(salePrice, s.sellerCommissionRate ? Number(s.sellerCommissionRate) : null),
		},
		special_conditions: s.specialConditions.trim() || null,
		generatedAt: new Date().toISOString(),
	};
}

export function DocumentWizard() {
	const router = useRouter();
	const upsertProperty = useAppStore((s) => s.upsertProperty);

	const [step, setStep] = useState<Step>("type");
	const [kind, setKind] = useState<DocKind>("rental");

	// Step 2 state — shared between rental and sales.
	const [properties, setProperties] = useState<Property[]>([]);
	const [loadingProperties, setLoadingProperties] = useState(false);
	const [propertyId, setPropertyId] = useState<string | null>(null);
	const property = useMemo(
		() => properties.find((p) => p.id === propertyId) ?? null,
		[properties, propertyId],
	);

	// Step "client" state — optional. Picking a client prefills the tenant/buyer fields.
	const [clients, setClients] = useState<Lead[]>([]);
	const [loadingClients, setLoadingClients] = useState(false);
	const [clientId, setClientId] = useState<string | null>(null);

	// Step 3 — rental state (init via RentalDetailsForm helper once a property is picked)
	const [rentalState, setRentalState] = useState<RentalFormState>(() => initialRentalFormState(null));
	function patchRental<K extends keyof RentalFormState>(key: K, value: RentalFormState[K]) {
		setRentalState((s) => ({ ...s, [key]: value }));
		clearFieldError(key === "tenantPhone" || key === "tenantEmail" ? "tenantContact" : key);
	}

	// Step 3 — sales state (init via SalesDetailsForm helper once a property is picked)
	const [salesState, setSalesState] = useState<SalesFormState>(() => initialSalesFormState(null));
	function patchSales<K extends keyof SalesFormState>(key: K, value: SalesFormState[K]) {
		setSalesState((s) => ({ ...s, [key]: value }));
		clearFieldError(key === "buyerPhone" || key === "buyerEmail" ? "buyerContact" : key);
	}

	function clearFieldError(key: string) {
		setFieldErrors((e) => {
			if (!(key in e)) return e;
			const next = { ...e };
			delete next[key];
			return next;
		});
	}

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	// Details entered in steps 4–5 are lost on a refresh/close — warn first.
	useEffect(() => {
		if (step !== "details" && step !== "preview") return;
		const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [step]);

	/** Validate the details step; on failure show inline errors and scroll to the first one. */
	function goToPreview() {
		const errors = kind === "rental" ? validateRental(rentalState) : validateSales(salesState);
		setFieldErrors(errors);
		const first = Object.keys(errors)[0];
		if (first) {
			document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		setStep("preview");
	}

	// The PDF embeds web fonts fetched over HTTP. BlobProvider renders eagerly,
	// so without this gate its first pass can run before the fonts arrive and
	// text collapses onto a single baseline. Hold the preview until fonts load.
	const [fontsLoaded, setFontsLoaded] = useState(false);
	useEffect(() => {
		if (step !== "preview" || fontsLoaded) return;
		let cancelled = false;
		import("@/src/lib/pdf/styles")
			.then((m) => m.loadPdfFonts())
			.then(() => { if (!cancelled) setFontsLoaded(true); });
		return () => { cancelled = true; };
	}, [step, fontsLoaded]);

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

	// Load clients whenever we enter the client step.
	useEffect(() => {
		if (step !== "client") return;
		setLoadingClients(true);
		setError(null);
		listLeads()
			.then(setClients)
			.catch((e) => setError(e instanceof Error ? e.message : String(e)))
			.finally(() => setLoadingClients(false));
	}, [step]);

	// Prefill the tenant (rental) / buyer (sales) party from a picked client.
	// Only fills empty fields so it never clobbers values the user already typed.
	function applyClient(id: string | null) {
		setClientId(id);
		if (!id) return;
		const lead = clients.find((c) => c.id === id);
		if (!lead) return;
		const phone = lead.phone ?? "";
		const email = lead.email ?? "";
		if (kind === "rental") {
			setRentalState((s) => ({
				...s,
				tenantName: s.tenantName.trim() ? s.tenantName : lead.full_name,
				tenantPhone: s.tenantPhone.trim() ? s.tenantPhone : phone,
				tenantEmail: s.tenantEmail.trim() ? s.tenantEmail : email,
			}));
		} else if (kind === "sales") {
			setSalesState((s) => ({
				...s,
				buyerName: s.buyerName.trim() ? s.buyerName : lead.full_name,
				buyerPhone: s.buyerPhone.trim() ? s.buyerPhone : phone,
				buyerEmail: s.buyerEmail.trim() ? s.buyerEmail : email,
			}));
		}
	}

	// When property is chosen, prefill rental-specific fields…
	useEffect(() => {
		if (!property) return;
		if (kind === "rental") {
			// Re-seed the rental form from the picked property, preserving any
			// tenant/guarantor/clause edits if the user bounces back+forward.
			setRentalState((prev) => ({
				...initialRentalFormState(property),
				tenantName: prev.tenantName,
				tenantAddress: prev.tenantAddress,
				tenantPhone: prev.tenantPhone,
				tenantEmail: prev.tenantEmail,
				tenantNationalId: prev.tenantNationalId,
				tenantTaxNo: prev.tenantTaxNo,
				tenantTaxOffice: prev.tenantTaxOffice,
				guarantorEnabled: prev.guarantorEnabled,
				guarantorName: prev.guarantorName,
				guarantorAddress: prev.guarantorAddress,
				guarantorNationalId: prev.guarantorNationalId,
				guarantorPhone: prev.guarantorPhone,
				guarantorEmail: prev.guarantorEmail,
				inventory: prev.inventory,
				conditionNotes: prev.conditionNotes,
				specialConditions: prev.specialConditions,
				rentIncreaseNote: prev.rentIncreaseNote,
			}));
		} else if (kind === "sales") {
			// Re-seed sales form whenever the picked property changes.
			setSalesState((prev) => ({
				...initialSalesFormState(property),
				// Preserve any user edits to buyer fields if they bounce back+forward.
				buyerName: prev.buyerName,
				buyerAddress: prev.buyerAddress,
				buyerPhone: prev.buyerPhone,
				buyerEmail: prev.buyerEmail,
				buyerNationalId: prev.buyerNationalId,
				buyerTaxNo: prev.buyerTaxNo,
				buyerTaxOffice: prev.buyerTaxOffice,
				specialConditions: prev.specialConditions,
			}));
		}
	}, [property, kind]);

	const rentalData = useMemo<RentalPDFData | null>(() => {
		if (kind !== "rental" || step !== "preview" || !property) return null;
		return buildRentalPDFData(property, rentalState);
	}, [kind, step, property, rentalState]);

	const salesData = useMemo<SalesPDFData | null>(() => {
		if (kind !== "sales" || step !== "preview" || !property) return null;
		return buildSalesPDFData(property, salesState);
	}, [kind, step, property, salesState]);

	async function handleConfirm() {
		if (!property) return;
		setSubmitting(true);
		setError(null);
		try {
			if (kind === "rental" && rentalData) {
				const s = rentalState;
				const tenant = await createTenant({
					full_name: s.tenantName.trim(),
					email: s.tenantEmail.trim() || null,
					phone: s.tenantPhone.trim() || null,
					national_id: s.tenantNationalId.trim() || null,
				});
				// Optional guarantor (kefil) is stored as its own tenants row.
				let guarantorId: string | null = null;
				if (s.guarantorEnabled && s.guarantorName.trim()) {
					const guarantor = await createTenant({
						full_name: s.guarantorName.trim(),
						email: s.guarantorEmail.trim() || null,
						phone: s.guarantorPhone.trim() || null,
						national_id: s.guarantorNationalId.trim() || null,
						notes: "Kefil (guarantor)",
					});
					guarantorId = guarantor.id;
				}
				await createLease({
					property_id: property.id,
					tenant_id: tenant.id,
					term: s.term,
					start_date: s.startDate,
					end_date: computeLeaseEndDate(s.startDate, s.term),
					monthly_rent: Number(s.monthlyRent || 0),
					deposit: Number(s.deposit || 0),
					currency: s.currency,
					guarantor_id: guarantorId,
					payment_day: s.paymentDay ? Number(s.paymentDay) : null,
					payment_method: s.paymentMethod.trim() || null,
					bank_account: s.bankAccount.trim() || null,
					util_electricity: s.utilElectricity,
					util_water: s.utilWater,
					util_gas: s.utilGas,
					util_internet: s.utilInternet,
					util_aidat: s.utilAidat,
					subletting_allowed: s.sublettingAllowed,
					rent_increase_note: s.rentIncreaseNote.trim() || null,
					inventory: s.inventory.filter((r) => r.item.trim()),
					condition_notes: s.conditionNotes.trim() || null,
					special_conditions: s.specialConditions.trim() || null,
				});
				const updated = await updateProperty(property.id, { status: "occupied" });
				upsertProperty(updated);
				invalidateCache("tenants");
				const filename = `kira-${safeFilename(tenant.full_name)}-${safeFilename(property.address_line)}.pdf`;
				await exportToPDF("rental", rentalData, filename);
				toast.success("Lease created and contract downloaded.");
				router.push(`/properties/${updated.id}`);
				return;
			}

			if (kind === "sales" && salesData) {
				// Buyer is stored in the tenants table (schema fits).
				const buyer = await createTenant({
					full_name: salesState.buyerName.trim(),
					email: salesState.buyerEmail.trim() || null,
					phone: salesState.buyerPhone.trim() || null,
					national_id: salesState.buyerNationalId.trim() || null,
				});
				await createSale({
					property_id: property.id,
					buyer_id: buyer.id,
					sale_price: Number(salesState.salePrice || 0),
					currency: salesState.currency,
					sale_date: salesState.saleDate,
					target_close_date: salesState.targetCloseDate || null,
					deposit_amount: salesState.depositAmount ? Number(salesState.depositAmount) : null,
					penalty_amount: salesState.penaltyAmount ? Number(salesState.penaltyAmount) : null,
					validity_days: salesState.validityDays ? Number(salesState.validityDays) : null,
					tax_responsibility: salesState.taxResponsibility,
					buyer_commission_rate:  salesState.buyerCommissionRate  ? Number(salesState.buyerCommissionRate)  : null,
					seller_commission_rate: salesState.sellerCommissionRate ? Number(salesState.sellerCommissionRate) : null,
					special_conditions: salesState.specialConditions.trim() || null,
				});
				const updated = await updateProperty(property.id, { status: "sold" });
				upsertProperty(updated);
				invalidateCache("tenants");
				const filename = `sales-${safeFilename(buyer.full_name)}-${safeFilename(property.address_line)}.pdf`;
				await exportToPDF("sales", salesData, filename);
				toast.success("Sale recorded and agreement downloaded.");
				router.push(`/properties/${updated.id}`);
				return;
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSubmitting(false);
		}
	}

	const previewData: RentalPDFData | SalesPDFData | null =
		kind === "rental" ? rentalData : salesData;
	const previewLabel = kind === "rental" ? "Kira sözleşmesi önizleme" : "Sales agreement preview";

	const stepIndex = STEPS.indexOf(step);

	return (
		<div>
			{/* Stepper */}
			<ol className="flex items-center gap-1.5 mb-6 text-xs font-semibold">
				{STEPS.map((s, i) => (
					<li key={s} className="flex items-center gap-1.5 min-w-0">
						<span
							className={cn(
								"w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0",
								step === s
									? "bg-primary text-primary-content"
									: i < stepIndex
										? "bg-emerald-500 text-white"
										: "bg-slate-200 text-slate-500",
							)}
						>{i + 1}</span>
						<span className={cn("capitalize hidden sm:inline", step === s ? "text-slate-900" : "text-slate-400")}>{s}</span>
						{i < STEPS.length - 1 && <span className="text-slate-300">›</span>}
					</li>
				))}
			</ol>

			{error && <Alert className="mb-4">{error}</Alert>}

			{/* Step 1: type */}
			{step === "type" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold text-slate-900">Choose a document type</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<button
							onClick={() => { setKind("rental"); setPropertyId(null); setClientId(null); setStep("property"); }}
							className="text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-primary/60 active:bg-primary/5 transition-colors"
						>
							<p className="text-base font-bold text-slate-900">Kira Sözleşmesi</p>
							<p className="text-sm text-slate-500 mt-1">Boş bir kiralık taşınmazı yeni bir kiracıya kiralayın.</p>
						</button>
						<button
							onClick={() => { setKind("sales"); setPropertyId(null); setClientId(null); setStep("property"); }}
							className="text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-primary/60 active:bg-primary/5 transition-colors"
						>
							<p className="text-base font-bold text-slate-900">Sales Agreement</p>
							<p className="text-sm text-slate-500 mt-1">Sell a for-sale property to a new buyer.</p>
						</button>
						<div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
							<p className="text-base font-bold text-slate-900">Rent Receipt</p>
							<p className="text-sm text-slate-500 mt-1">Coming soon.</p>
						</div>
					</div>
				</div>
			)}

			{/* Step 2: property */}
			{step === "property" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold text-slate-900">Pick a property</h2>
					{loadingProperties ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : (
						<PropertyPickerCardList
							properties={properties}
							selectedId={propertyId}
							onSelect={setPropertyId}
							emptyHint={
								kind === "rental"
									? "The rental wizard only lists for-rent properties that are currently vacant."
									: "The sales wizard only lists for-sale properties that aren't already sold."
							}
						/>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("type")}>← Back</Button>
						<Button onClick={() => setStep("client")} disabled={!propertyId}>Continue →</Button>
					</div>
				</div>
			)}

			{/* Step 3: client (optional prefill of the tenant/buyer party) */}
			{step === "client" && (
				<div className="space-y-4">
					<div>
						<h2 className="text-lg font-bold text-slate-900">Pick a client</h2>
						<p className="text-sm text-slate-500 mt-1">
							Optional — selecting a client prefills the {kind === "rental" ? "tenant" : "buyer"} details.
							You can also skip and enter them manually.
						</p>
					</div>
					{loadingClients ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : (
						<ClientPickerCardList
							clients={clients}
							selectedId={clientId}
							onSelect={applyClient}
							emptyHint="Add clients from the Clients page to prefill documents from them."
						/>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("property")}>← Back</Button>
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => { applyClient(null); setStep("details"); }}>Skip</Button>
							<Button onClick={() => setStep("details")}>Continue →</Button>
						</div>
					</div>
				</div>
			)}

			{/* Step 4: details */}
			{step === "details" && property && kind === "rental" && (
				<div className="space-y-5">
					<div>
						<h2 className="text-lg font-bold text-slate-900">Kira sözleşmesi detayları</h2>
						<p className="text-sm text-slate-500 mt-1">{property.address_line}{property.city ? `, ${property.city}` : ""}</p>
					</div>

					<RentalDetailsForm state={rentalState} onChange={patchRental} errors={fieldErrors} />

					{Object.keys(fieldErrors).length > 0 && (
						<Alert>Some required fields are missing — check the highlighted fields above.</Alert>
					)}

					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("client")}>← Back</Button>
						<Button onClick={goToPreview}>Preview →</Button>
					</div>
				</div>
			)}

			{step === "details" && property && kind === "sales" && (
				<div className="space-y-5">
					<div>
						<h2 className="text-lg font-bold text-slate-900">Sales agreement details</h2>
						<p className="text-sm text-slate-500 mt-1">{property.address_line}{property.city ? `, ${property.city}` : ""}</p>
					</div>

					<SalesDetailsForm state={salesState} onChange={patchSales} errors={fieldErrors} />

					{Object.keys(fieldErrors).length > 0 && (
						<Alert>Some required fields are missing — check the highlighted fields above.</Alert>
					)}

					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("client")}>← Back</Button>
						<Button onClick={goToPreview}>Preview →</Button>
					</div>
				</div>
			)}

			{/* Step 4: preview */}
			{step === "preview" && previewData && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold text-slate-900">Review &amp; generate</h2>
					<div className="h-[60vh] sm:h-[72vh] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
						{!fontsLoaded ? (
							<div className="h-full flex items-center justify-center"><Spinner /></div>
						) : (
						<PDFBlobProvider document={<PDFDocument kind={kind} data={previewData} />}>
							{({ url, loading, error: blobError }) => {
								if (loading || !url) {
									return (
										<div className="h-full flex items-center justify-center"><Spinner /></div>
									);
								}
								if (blobError) {
									return (
										<div className="h-full flex items-center justify-center text-sm text-red-600 p-6">
											Preview failed to render: {String(blobError)}
										</div>
									);
								}
								return (
									<iframe
										src={`${url}#toolbar=0&navpanes=0`}
										className="w-full h-full border-0"
										title={previewLabel}
									/>
								);
							}}
						</PDFBlobProvider>
						)}
					</div>
					<div className="flex justify-between gap-2 pt-2">
						<Button variant="ghost" onClick={() => setStep("details")} disabled={submitting}>← Back</Button>
						<Button
							onClick={handleConfirm}
							loading={submitting}
							className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-soft"
						>
							{submitting ? "Generating…" : "Confirm & generate PDF"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
