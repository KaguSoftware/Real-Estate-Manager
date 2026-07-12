"use client";

import { humanizeError } from "@/src/lib/errors";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";
import { listEligiblePropertiesForDocType } from "@/src/lib/db/properties";
import { listLeads } from "@/src/lib/db/leads";
import { computeLeaseEndDate } from "@/src/lib/db/leases";
import { createRentalRecords, createSalesRecords } from "@/src/lib/db/documentRecords";
import { downloadPdfFile, generateEditorPdfFile, getPdfBrandingFromStore, type PdfBranding } from "@/src/lib/pdf";
import { saveDocumentPdf } from "@/src/lib/db/documents";
import { getClauseTemplate } from "@/src/lib/db/clauseTemplates";
import type { DocKind, RentalPDFData, SalesPDFData } from "@/src/lib/pdf";
import { EditorPDFDocument, DEFAULT_PALETTE } from "@/src/lib/pdf";
import { buildInitialDoc } from "@/src/lib/documents/buildInitialDoc";
import type { EditorDocJSON } from "@/src/lib/documents/blocks";
import { createContractDocument, setContractDocumentPdfPath } from "@/src/lib/db/contractDocuments";
import type { ContractEditorHandle } from "./editor/ContractEditor";
import type { Property, Lead } from "@/src/lib/db/types";
import { PropertyPickerCardList } from "./PropertyPickerCardList";
import { ClientPickerCardList } from "./ClientPickerCardList";
import { Button, cn, Alert, Spinner, toast, Input, FormField, ConfirmDialog } from "@/src/components/ui";
import { invalidateCache } from "@/src/lib/useCachedResource";
import {
	initialSalesFormState,
	computeCommission,
	validateSales,
	type SalesFormState,
} from "./SalesDetailsForm";
import {
	initialRentalFormState,
	validateRental,
	type RentalFormState,
} from "./RentalDetailsForm";
import {
	extractRentalFromDoc,
	extractSalesFromDoc,
	type RentalDocExtract,
	type SalesDocExtract,
} from "@/src/lib/documents/extractFromDoc";

const PDFBlobProvider = dynamic(
	() => import("@react-pdf/renderer").then((m) => m.BlobProvider),
	{ ssr: false, loading: () => <div className="text-sm text-base-content/50 p-6">Önizleme yükleniyor…</div> },
);

// Tiptap ships only with the editor step — same SSR/bundle policy as react-pdf.
const ContractEditor = dynamic(
	() => import("./editor/ContractEditor").then((m) => m.ContractEditor),
	{ ssr: false, loading: () => <div className="text-sm text-base-content/50 p-6 text-center">Düzenleyici yükleniyor…</div> },
);

// The old separate "details" step is merged into the final stage: a
// collapsible essentials panel (parties, amounts, dates — the fields the
// lease/sale records need) sits above the editor and the document rebuilds
// live as it is filled. Old drafts saved at "details" resume at "preview".
type Step = "type" | "property" | "client" | "preview";

const STEPS: Step[] = ["type", "property", "client", "preview"];

const STEP_LABELS: Record<Step, string> = {
	type: "Tür",
	property: "Taşınmaz",
	client: "Müşteri",
	preview: "Düzenle",
};

// Wizard progress survives a refresh/accidental close via localStorage.
// v2 adds the editable document (docJson/docTitle/docSubtitle/docFingerprint);
// v1 drafts (pre-editor) are still readable — the editor step simply rebuilds
// the document from the restored form state.
const DRAFT_KEY = "docwizard:draft:v2";
const DRAFT_KEY_V1 = "docwizard:draft:v1";

interface WizardDraft {
	step: Step;
	kind: DocKind;
	propertyId: string | null;
	clientId: string | null;
	rentalState: RentalFormState;
	salesState: SalesFormState;
	savedAt: string;
	// v2 fields (absent on v1 drafts)
	docJson?: EditorDocJSON | null;
	docTitle?: string;
	docSubtitle?: string;
	docFingerprint?: string | null;
	// Team clause set the doc was built with — restored on resume so a failed
	// re-fetch can't shift the fingerprint and trip the stale banner.
	teamClauses?: string[] | null;
}

function readDraft(): WizardDraft | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(DRAFT_KEY) ?? window.localStorage.getItem(DRAFT_KEY_V1);
		if (!raw) return null;
		const d = JSON.parse(raw) as Partial<WizardDraft> | null;
		// Shape-check before trusting: a stale or hand-edited draft with the
		// wrong nested types would crash the wizard mid-resume, which is worse
		// than silently starting fresh.
		if (
			!d ||
			typeof d !== "object" ||
			!STEPS.includes(d.step as Step) ||
			!["rental", "sales", "receipt", "listing"].includes(d.kind as string) ||
			typeof d.rentalState !== "object" || d.rentalState === null ||
			typeof d.salesState !== "object" || d.salesState === null ||
			typeof d.savedAt !== "string" || Number.isNaN(Date.parse(d.savedAt)) ||
			(d.docJson != null && typeof d.docJson !== "object") ||
			(d.docTitle != null && typeof d.docTitle !== "string") ||
			(d.teamClauses != null && !Array.isArray(d.teamClauses))
		) {
			return null;
		}
		return d as WizardDraft;
	} catch {
		return null;
	}
}

function clearDraft() {
	try {
		window.localStorage.removeItem(DRAFT_KEY);
		window.localStorage.removeItem(DRAFT_KEY_V1);
	} catch { /* ignore */ }
}

function safeFilename(s: string) {
	return s.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
}

// The final stage has no form — the document IS the form. At confirm time
// the structured cards are read back (extractFromDoc) and merged over the
// wizard state so validation and record creation reuse the same shapes.
function mergeRentalExtract(s: RentalFormState, ex: RentalDocExtract): RentalFormState {
	return {
		...s,
		landlordName: ex.landlord?.full_name ?? "",
		landlordAddress: ex.landlord?.address ?? "",
		landlordNationalId: ex.landlord?.national_id ?? "",
		landlordTaxNo: ex.landlord?.tax_no ?? "",
		landlordTaxOffice: ex.landlord?.tax_office ?? "",
		landlordPhone: ex.landlord?.phone ?? "",
		landlordEmail: ex.landlord?.email ?? "",
		tenantName: ex.tenant?.full_name ?? "",
		tenantAddress: ex.tenant?.address ?? "",
		tenantNationalId: ex.tenant?.national_id ?? "",
		tenantTaxNo: ex.tenant?.tax_no ?? "",
		tenantTaxOffice: ex.tenant?.tax_office ?? "",
		tenantPhone: ex.tenant?.phone ?? "",
		tenantEmail: ex.tenant?.email ?? "",
		guarantorEnabled: Boolean(ex.guarantor?.full_name?.trim()),
		guarantorName: ex.guarantor?.full_name ?? "",
		guarantorAddress: ex.guarantor?.address ?? "",
		guarantorNationalId: ex.guarantor?.national_id ?? "",
		guarantorPhone: ex.guarantor?.phone ?? "",
		guarantorEmail: ex.guarantor?.email ?? "",
		monthlyRent: ex.monthlyRent != null ? String(ex.monthlyRent) : "",
		deposit: ex.deposit != null ? String(ex.deposit) : "0",
		currency: ex.currency ?? s.currency,
		term: ex.term ?? s.term,
		// Unreadable (but present) date text must fail validation, not fall
		// back silently to the default — the PDF would disagree with the DB.
		startDate: ex.startDate ?? (ex.startDateRaw ? "" : s.startDate),
		paymentDay: ex.paymentDay != null ? String(ex.paymentDay) : s.paymentDay,
		paymentMethod: ex.paymentMethod ?? "",
		bankAccount: ex.bankAccount ?? "",
	};
}

function mergeSalesExtract(s: SalesFormState, ex: SalesDocExtract): SalesFormState {
	return {
		...s,
		sellerName: ex.seller?.full_name ?? "",
		sellerAddress: ex.seller?.address ?? "",
		sellerNationalId: ex.seller?.national_id ?? "",
		sellerTaxNo: ex.seller?.tax_no ?? "",
		sellerTaxOffice: ex.seller?.tax_office ?? "",
		sellerPhone: ex.seller?.phone ?? "",
		sellerEmail: ex.seller?.email ?? "",
		buyerName: ex.buyer?.full_name ?? "",
		buyerAddress: ex.buyer?.address ?? "",
		buyerNationalId: ex.buyer?.national_id ?? "",
		buyerTaxNo: ex.buyer?.tax_no ?? "",
		buyerTaxOffice: ex.buyer?.tax_office ?? "",
		buyerPhone: ex.buyer?.phone ?? "",
		buyerEmail: ex.buyer?.email ?? "",
		salePrice: ex.salePrice != null ? String(ex.salePrice) : "",
		depositAmount: ex.depositAmount != null ? String(ex.depositAmount) : "",
		currency: ex.currency ?? s.currency,
	};
}

function buildRentalPDFData(
	property: Property,
	s: RentalFormState,
	teamClauses?: string[] | null,
): RentalPDFData {
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
		clauses: teamClauses ?? undefined,
		generatedAt: new Date().toISOString(),
	};
}

function buildSalesPDFData(
	property: Property,
	s: SalesFormState,
	teamClauses?: string[] | null,
): SalesPDFData {
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
			city: property.city,
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
		clauses: teamClauses ?? undefined,
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

	// Wizard form state seeds the INITIAL document (property/client prefills
	// plus sensible defaults). After that the document itself is the source
	// of truth — confirm reads the final values back out of its cards.
	const [rentalState, setRentalState] = useState<RentalFormState>(() => initialRentalFormState(null));
	const [salesState, setSalesState] = useState<SalesFormState>(() => initialSalesFormState(null));

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Records already created by a partially-failed confirm — a retry must
	// reuse them, not create duplicates (tenant/lease/sale are not atomic).
	const createdRef = useRef<{
		tenantId?: string;
		guarantorId?: string;
		leaseId?: string;
		buyerId?: string;
		saleId?: string;
		propertyDone?: boolean;
		contractDocId?: string;
	}>({});

	// ── Editable document state (final step) ────────────────────────────
	const [docJson, setDocJson] = useState<EditorDocJSON | null>(null);
	const [docTitle, setDocTitle] = useState("");
	const [docSubtitle, setDocSubtitle] = useState("");
	// Snapshot of the wizard data the document was built from — when the user
	// goes back and changes details, the doc is rebuilt so amounts/parties are
	// never stale (custom text edits survive only while the data is unchanged).
	const [docFingerprint, setDocFingerprint] = useState<string | null>(null);
	// True once the user has edited the document itself — from then on, panel
	// changes stop live-rebuilding it (a banner offers an explicit rebuild).
	const [docDirty, setDocDirty] = useState(false);
	// Data changed while the doc was dirty: doc no longer matches the fields.
	const [docStale, setDocStale] = useState(false);
	const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
	// Team clause template state — declared here (before the draft persist
	// effect that references it) to avoid a temporal-dead-zone crash.
	const [teamClauses, setTeamClauses] = useState<string[] | null>(null);
	const [clausesReady, setClausesReady] = useState(false);
	const clausesFetchedFor = useRef<string | null>(null);
	const [previewJson, setPreviewJson] = useState<EditorDocJSON | null>(null);
	const [confirmReset, setConfirmReset] = useState(false);
	const editorApi = useRef<ContractEditorHandle | null>(null);

	// Offer to resume a saved draft from a previous (interrupted) session.
	const [pendingDraft, setPendingDraft] = useState<WizardDraft | null>(() => readDraft());
	const restoringDraft = useRef(false);
	function resumeDraft() {
		if (!pendingDraft) return;
		restoringDraft.current = Boolean(pendingDraft.propertyId);
		setKind(pendingDraft.kind);
		setPropertyId(pendingDraft.propertyId);
		setClientId(pendingDraft.clientId);
		// Merge over fresh defaults: fields added after the draft was saved
		// would otherwise be undefined and crash .trim()/validation later.
		setRentalState({ ...initialRentalFormState(null), ...(pendingDraft.rentalState ?? {}) });
		setSalesState({ ...initialSalesFormState(null), ...(pendingDraft.salesState ?? {}) });
		if ("teamClauses" in pendingDraft) {
			setTeamClauses(pendingDraft.teamClauses ?? null);
			setClausesReady(true);
			clausesFetchedFor.current = pendingDraft.kind;
		}
		// v2 drafts carry the edited document; v1 drafts rebuild it from the
		// restored form state when the editor step is entered.
		setDocJson(pendingDraft.docJson ?? null);
		setDocTitle(pendingDraft.docTitle ?? "");
		setDocSubtitle(pendingDraft.docSubtitle ?? "");
		setDocFingerprint(pendingDraft.docFingerprint ?? null);
		// A saved document may hold custom edits we can't distinguish from the
		// generated template — treat it as dirty so live rebuild never clobbers it.
		setDocDirty(Boolean(pendingDraft.docJson));
		// Drafts saved on the retired "details" step resume at the merged stage.
		const restoredStep: Step =
			(pendingDraft.step as string) === "details" ? "preview" : pendingDraft.step;
		setStep(pendingDraft.propertyId ? restoredStep : "type");
		setPendingDraft(null);
	}
	function discardDraft() {
		clearDraft();
		setPendingDraft(null);
	}

	// Persist progress once the user has invested real effort (final stage).
	useEffect(() => {
		if (pendingDraft) return; // don't overwrite an unresumed draft
		if (step !== "preview") return;
		const draft: WizardDraft = {
			step, kind, propertyId, clientId, rentalState, salesState,
			docJson, docTitle, docSubtitle, docFingerprint, teamClauses,
			savedAt: new Date().toISOString(),
		};
		try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
	}, [pendingDraft, step, kind, propertyId, clientId, rentalState, salesState, docJson, docTitle, docSubtitle, docFingerprint, teamClauses]);

	// An unresumed draft blocks autosave (it must not be overwritten while the
	// user can still choose "Devam et"). The choice window ends when they start
	// a new flow — keep the banner only on the first step.
	useEffect(() => {
		if (pendingDraft && step !== "type") setPendingDraft(null);
	}, [pendingDraft, step]);

	// Work done in the final stage is lost on a refresh/close — warn first.
	useEffect(() => {
		if (step !== "preview") return;
		const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [step]);

	// The PDF embeds web fonts fetched over HTTP. BlobProvider renders eagerly,
	// so without this gate its first pass can run before the fonts arrive and
	// text collapses onto a single baseline. Hold the preview until fonts load.
	const [fontsLoaded, setFontsLoaded] = useState(false);
	const [previewBranding, setPreviewBranding] = useState<PdfBranding | undefined>(undefined);
	const [assetError, setAssetError] = useState<string | null>(null);
	const [assetRetry, setAssetRetry] = useState(0);
	useEffect(() => {
		if (step !== "preview" || fontsLoaded) return;
		let cancelled = false;
		setAssetError(null);
		// Team branding (name/logo/palette) is resolved with the fonts so the
		// preview matches the downloaded document. A failure must surface with
		// a retry — an uncaught rejection here means a spinner forever.
		Promise.all([
			import("@/src/lib/pdf/styles").then((m) => m.loadPdfFonts()),
			getPdfBrandingFromStore(),
		])
			.then(([, b]) => {
				if (cancelled) return;
				setPreviewBranding(b);
				setFontsLoaded(true);
			})
			.catch((e) => { if (!cancelled) setAssetError(humanizeError(e)); });
		return () => { cancelled = true; };
	}, [step, fontsLoaded, assetRetry]);

	// The team's clause template (if any) overrides the built-in T&C set.
	// Fetched once per kind on entering the final stage; re-entries reuse the
	// cached set so the doc fingerprint stays stable across back/forward.
	useEffect(() => {
		if (step !== "preview" || (kind !== "rental" && kind !== "sales")) return;
		if (clausesFetchedFor.current === kind) return;
		let cancelled = false;
		setClausesReady(false);
		getClauseTemplate(kind)
			.then((c) => { if (!cancelled) { setTeamClauses(c); clausesFetchedFor.current = kind; } })
			.catch(() => { if (!cancelled) setTeamClauses(null); })
			.finally(() => { if (!cancelled) setClausesReady(true); });
		return () => { cancelled = true; };
	}, [step, kind]);

	// Load eligible properties on step 2 — and on the final step when a draft
	// resumed straight into it (the picked property must be re-fetched, or the
	// stage has nothing to render and the screen goes blank).
	const [propertiesLoaded, setPropertiesLoaded] = useState(false);
	useEffect(() => {
		const resumedIntoPreview = step === "preview" && propertyId != null && !propertiesLoaded;
		if (step !== "property" && !resumedIntoPreview) return;
		// Already loaded: picking a card only changes propertyId and must not refetch.
		if (step === "property" && propertiesLoaded) return;
		let cancelled = false;
		setLoadingProperties(true);
		setError(null);
		listEligiblePropertiesForDocType(kind)
			.then((p) => { if (!cancelled) { setProperties(p); setPropertiesLoaded(true); } })
			.catch((e) => { if (!cancelled) setError(humanizeError(e)); })
			.finally(() => { if (!cancelled) setLoadingProperties(false); });
		return () => { cancelled = true; };
	}, [step, kind, propertyId, propertiesLoaded]);

	// Load clients whenever we enter the client step.
	useEffect(() => {
		if (step !== "client") return;
		let cancelled = false;
		setLoadingClients(true);
		setError(null);
		listLeads()
			.then((c) => { if (!cancelled) setClients(c); })
			.catch((e) => { if (!cancelled) setError(humanizeError(e)); })
			.finally(() => { if (!cancelled) setLoadingClients(false); });
		return () => { cancelled = true; };
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
	// Keyed by property ID, not object identity: re-entering the property step
	// refetches the list (new identities), and an identity-keyed reseed wiped
	// the user's typed amounts/dates on every back-and-forward pass.
	const seededKey = useRef<string | null>(null);
	useEffect(() => {
		if (!property) return;
		const key = `${kind}:${property.id}`;
		// On draft resume the property arrives async AFTER the form state was
		// restored — reseeding would clobber the restored fields.
		if (restoringDraft.current) {
			restoringDraft.current = false;
			seededKey.current = key;
			return;
		}
		if (seededKey.current === key) return;
		seededKey.current = key;
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
		return buildRentalPDFData(property, rentalState, teamClauses);
	}, [kind, step, property, rentalState, teamClauses]);

	const salesData = useMemo<SalesPDFData | null>(() => {
		if (kind !== "sales" || step !== "preview" || !property) return null;
		return buildSalesPDFData(property, salesState, teamClauses);
	}, [kind, step, property, salesState, teamClauses]);

	const wizardData: RentalPDFData | SalesPDFData | null =
		kind === "rental" ? rentalData : salesData;

	useEffect(() => {
		if (step !== "preview" || !fontsLoaded || !clausesReady || !wizardData) return;
		if (kind !== "rental" && kind !== "sales") return;
		const fingerprint = JSON.stringify({ ...wizardData, generatedAt: null });
		if (docJson && fingerprint === docFingerprint) {
			if (docStale) setDocStale(false); // data reverted to match the doc
			return;
		}
		// The user customized the document — never clobber it silently; the
		// stale banner offers an explicit rebuild instead.
		if (docJson && docDirty) {
			if (!docStale) setDocStale(true);
			return;
		}
		// Debounced: wizardData changes identity on every panel keystroke, and
		// each run clears the previous timer — the doc rebuilds 500 ms after
		// the user stops typing (immediately on first build).
		const t = setTimeout(() => {
			const built = buildInitialDoc(kind, wizardData, previewBranding?.teamName ?? "Kagu Real Estate");
			setDocJson(built);
			setDocFingerprint(fingerprint);
			editorApi.current?.setContent(built);
			setPreviewJson((p) => (p ? built : p)); // keep an open PDF preview live
			if (!docTitle) setDocTitle(kind === "rental" ? "Konut Kira Sözleşmesi" : "Satılık Alım, Satış Sözleşmesi");
			if (!docSubtitle) setDocSubtitle(wizardData.property.address ?? "");
		}, docJson ? 500 : 0);
		return () => clearTimeout(t);
	}, [step, kind, fontsLoaded, clausesReady, wizardData, previewBranding, docJson, docFingerprint, docDirty, docStale, docTitle, docSubtitle]);

	/** Latest editor JSON — the live editor when mounted, else wizard state. */
	function currentDocJson(): EditorDocJSON | null {
		return (viewMode === "edit" ? editorApi.current?.getJSON() : null) ?? docJson;
	}

	function switchMode(mode: "edit" | "preview") {
		if (mode === viewMode) return;
		if (mode === "preview") {
			const json = currentDocJson();
			if (!json) return;
			setDocJson(json);
			setPreviewJson(json);
		}
		setViewMode(mode);
	}

	/** Rebuild the document from the current panel data (discards custom edits). */
	function rebuildFromData() {
		if (!wizardData || (kind !== "rental" && kind !== "sales")) return;
		const built = buildInitialDoc(kind, wizardData, previewBranding?.teamName ?? "Kagu Real Estate");
		setDocJson(built);
		setDocFingerprint(JSON.stringify({ ...wizardData, generatedAt: null }));
		editorApi.current?.setContent(built);
		setPreviewJson((p) => (p ? built : p));
		setDocDirty(false);
		setDocStale(false);
	}

	function onResetConfirmed() {
		setConfirmReset(false);
		rebuildFromData();
		toast.success("Belge şablondan yeniden oluşturuldu.");
	}

	async function handleConfirm() {
		if (!property) return;
		// A stale doc would create records with the new data but a PDF with the
		// old — never let those diverge.
		if (docStale) {
			toast.error("Bilgiler değişti ancak belgeye uygulanmadı — önce belgeyi yeniden oluşturun.");
			return;
		}
		const finalJson = currentDocJson();
		if (!finalJson) return;

		// The document IS the form: read the structured values back out of its
		// cards and validate them before creating any records.
		let mergedRental = rentalState;
		let mergedSales = salesState;
		let errors: Record<string, string>;
		if (kind === "rental") {
			const ex = extractRentalFromDoc(finalJson);
			mergedRental = mergeRentalExtract(rentalState, ex);
			errors = validateRental(mergedRental);
			if (ex.startDateRaw && !ex.startDate) {
				errors.startDate =
					`Başlangıç tarihi okunamadı ("${ex.startDateRaw}") — "12 Temmuz 2026" ya da "12.07.2026" biçiminde yazın.`;
			}
		} else {
			const ex = extractSalesFromDoc(finalJson);
			mergedSales = mergeSalesExtract(salesState, ex);
			errors = validateSales(mergedSales);
		}
		if (Object.keys(errors).length > 0) {
			setViewMode("edit");
			setError("Belgedeki kartlarda eksik veya okunamayan bilgiler var: " + Object.values(errors).join(" "));
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			if (kind === "rental") {
				const s = mergedRental;
				// Snapshot built from the document's own values — this is what
				// the archived PDF and the re-edit page will show.
				const rentalDataFinal = buildRentalPDFData(property, s, teamClauses);
				const c = createdRef.current;
				if (!c.leaseId) {
					// Single transactional RPC: tenant, optional guarantor (kefil),
					// lease and property status commit together or not at all.
					const created = await createRentalRecords({
						property_id: property.id,
						tenant: {
							full_name: s.tenantName.trim(),
							email: s.tenantEmail.trim() || null,
							phone: s.tenantPhone.trim() || null,
							national_id: s.tenantNationalId.trim() || null,
						},
						guarantor:
							s.guarantorEnabled && s.guarantorName.trim()
								? {
										full_name: s.guarantorName.trim(),
										email: s.guarantorEmail.trim() || null,
										phone: s.guarantorPhone.trim() || null,
										national_id: s.guarantorNationalId.trim() || null,
									}
								: null,
						lease: {
							term: s.term,
							start_date: s.startDate,
							end_date: computeLeaseEndDate(s.startDate, s.term),
							monthly_rent: Number(s.monthlyRent || 0),
							deposit: Number(s.deposit || 0),
							currency: s.currency,
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
						},
					});
					c.tenantId = created.tenant_id;
					c.guarantorId = created.guarantor_id ?? undefined;
					c.leaseId = created.lease_id;
					c.propertyDone = true;
					upsertProperty({ ...property, status: "occupied" });
				}
				invalidateCache("tenants");
				invalidateCache("properties");
				// Persist the editable document first (re-editable later from the
				// property page). Best-effort: a failure must not lose the PDF.
				const title = docTitle.trim() || "Konut Kira Sözleşmesi";
				if (!c.contractDocId) {
					try {
						const cd = await createContractDocument({
							kind: "rental",
							lease_id: c.leaseId,
							title,
							subtitle: docSubtitle.trim() || null,
							content: finalJson,
							source_data: rentalDataFinal,
						});
						c.contractDocId = cd.id;
					} catch {
						toast.error("Belgenin düzenlenebilir kopyası kaydedilemedi.");
					}
				}
				const filename = `kira-${safeFilename(s.tenantName.trim())}-${safeFilename(property.address_line)}.pdf`;
				const pdfFile = await generateEditorPdfFile(
					{
						kind: "rental",
						title,
						subtitle: docSubtitle.trim() || null,
						doc: finalJson,
						sourceData: rentalDataFinal,
						branding: await getPdfBrandingFromStore(),
					},
					filename,
				);
				await downloadPdfFile(pdfFile);
				// Keep a copy in storage for later reference. Best-effort: the
				// user already has the download, so a failed upload only warns.
				try {
					const path = await saveDocumentPdf({ table: "leases", id: c.leaseId }, pdfFile);
					if (c.contractDocId) await setContractDocumentPdfPath(c.contractDocId, path);
				} catch {
					toast.error("Sözleşme indirildi ancak çevrimiçi kopya kaydedilemedi.");
				}
				clearDraft();
				createdRef.current = {};
				toast.success("Kira sözleşmesi oluşturuldu ve indirildi.");
				router.push(`/properties/${property.id}`);
				return;
			}

			if (kind === "sales") {
				const s = mergedSales;
				const salesDataFinal = buildSalesPDFData(property, s, teamClauses);
				const c = createdRef.current;
				if (!c.saleId) {
					// Single transactional RPC: buyer (stored in tenants — schema
					// fits), sale and property status commit together or not at all.
					const created = await createSalesRecords({
						property_id: property.id,
						buyer: {
							full_name: s.buyerName.trim(),
							email: s.buyerEmail.trim() || null,
							phone: s.buyerPhone.trim() || null,
							national_id: s.buyerNationalId.trim() || null,
						},
						sale: {
							sale_price: Number(s.salePrice || 0),
							currency: s.currency,
							sale_date: s.saleDate,
							target_close_date: s.targetCloseDate || null,
							deposit_amount: s.depositAmount ? Number(s.depositAmount) : null,
							penalty_amount: s.penaltyAmount ? Number(s.penaltyAmount) : null,
							validity_days: s.validityDays ? Number(s.validityDays) : null,
							tax_responsibility: s.taxResponsibility,
							buyer_commission_rate:  s.buyerCommissionRate  ? Number(s.buyerCommissionRate)  : null,
							seller_commission_rate: s.sellerCommissionRate ? Number(s.sellerCommissionRate) : null,
							special_conditions: s.specialConditions.trim() || null,
						},
					});
					c.buyerId = created.buyer_id;
					c.saleId = created.sale_id;
					c.propertyDone = true;
					upsertProperty({ ...property, status: "sold" });
				}
				invalidateCache("tenants");
				invalidateCache("properties");
				const title = docTitle.trim() || "Satılık Alım, Satış Sözleşmesi";
				if (!c.contractDocId) {
					try {
						const cd = await createContractDocument({
							kind: "sales",
							sale_id: c.saleId,
							title,
							subtitle: docSubtitle.trim() || null,
							content: finalJson,
							source_data: salesDataFinal,
						});
						c.contractDocId = cd.id;
					} catch {
						toast.error("Belgenin düzenlenebilir kopyası kaydedilemedi.");
					}
				}
				const filename = `satis-${safeFilename(s.buyerName.trim())}-${safeFilename(property.address_line)}.pdf`;
				const pdfFile = await generateEditorPdfFile(
					{
						kind: "sales",
						title,
						subtitle: docSubtitle.trim() || null,
						doc: finalJson,
						sourceData: salesDataFinal,
						branding: await getPdfBrandingFromStore(),
					},
					filename,
				);
				await downloadPdfFile(pdfFile);
				try {
					const path = await saveDocumentPdf({ table: "sales", id: c.saleId }, pdfFile);
					if (c.contractDocId) await setContractDocumentPdfPath(c.contractDocId, path);
				} catch {
					toast.error("Sözleşme indirildi ancak çevrimiçi kopya kaydedilemedi.");
				}
				clearDraft();
				createdRef.current = {};
				toast.success("Satış kaydedildi ve sözleşme indirildi.");
				router.push(`/properties/${property.id}`);
				return;
			}
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setSubmitting(false);
		}
	}

	const previewLabel = kind === "rental" ? "Kira sözleşmesi önizleme" : "Satış sözleşmesi önizleme";

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
										? "bg-success text-success-content"
										: "bg-base-300 text-base-content/60",
							)}
						>{i + 1}</span>
						<span className={cn("hidden sm:inline", step === s ? "text-base-content" : "text-base-content/50")}>{STEP_LABELS[s]}</span>
						{i < STEPS.length - 1 && <span className="text-base-content/30">›</span>}
					</li>
				))}
			</ol>

			{pendingDraft && (
				<Alert
					tone="warning"
					className="mb-4"
					action={
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={resumeDraft}>Devam et</Button>
							<Button size="sm" variant="ghost" onClick={discardDraft}>Sil</Button>
						</div>
					}
				>
					Önceki oturumdan yarım kalmış bir {pendingDraft.kind === "rental" ? "kira sözleşmesi" : "satış sözleşmesi"} belgeniz var.
				</Alert>
			)}

			{error && <Alert className="mb-4">{error}</Alert>}

			{/* Step 1: type */}
			{step === "type" && (
				<div className="space-y-4">
					<h2 className="font-display text-lg font-semibold text-base-content">Belge türünü seçin</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<button
							onClick={() => { setKind("rental"); setPropertyId(null); setClientId(null); setPropertiesLoaded(false); setStep("property"); }}
							className="text-left p-5 rounded-2xl border-2 border-base-300 hover:border-primary/60 active:bg-primary/5 transition-colors"
						>
							<p className="font-display text-base font-semibold text-base-content">Kira Sözleşmesi</p>
							<p className="text-sm text-base-content/60 mt-1">Boş bir kiralık taşınmazı yeni bir kiracıya kiralayın.</p>
						</button>
						<button
							onClick={() => { setKind("sales"); setPropertyId(null); setClientId(null); setPropertiesLoaded(false); setStep("property"); }}
							className="text-left p-5 rounded-2xl border-2 border-base-300 hover:border-primary/60 active:bg-primary/5 transition-colors"
						>
							<p className="font-display text-base font-semibold text-base-content">Satış Sözleşmesi</p>
							<p className="text-sm text-base-content/60 mt-1">Satılık bir taşınmazı yeni bir alıcıya satın.</p>
						</button>
						<div className="p-5 rounded-2xl border border-base-300 bg-base-200">
							<p className="font-display text-base font-semibold text-base-content">Kira Makbuzu</p>
							<p className="text-sm text-base-content/60 mt-1">
								Her ödeme için ayrı oluşturulur — taşınmazın Ödemeler listesini açın ve
								satırdaki makbuz işlemini kullanın.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Step 2: property */}
			{step === "property" && (
				<div className="space-y-4">
					<h2 className="font-display text-lg font-semibold text-base-content">Taşınmaz seçin</h2>
					{loadingProperties ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : (
						<PropertyPickerCardList
							properties={properties}
							selectedId={propertyId}
							onSelect={setPropertyId}
							emptyHint={
								kind === "rental"
									? "Kiralama sihirbazı yalnızca şu anda boş olan kiralık taşınmazları listeler."
									: "Satış sihirbazı yalnızca henüz satılmamış satılık taşınmazları listeler."
							}
						/>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("type")}>← Geri</Button>
						<Button onClick={() => setStep("client")} disabled={!propertyId}>Devam →</Button>
					</div>
				</div>
			)}

			{/* Step 3: client (optional prefill of the tenant/buyer party) */}
			{step === "client" && (
				<div className="space-y-4">
					<div>
						<h2 className="font-display text-lg font-semibold text-base-content">Müşteri seçin</h2>
						<p className="text-sm text-base-content/60 mt-1">
							İsteğe bağlı — bir müşteri seçmek {kind === "rental" ? "kiracı" : "alıcı"} bilgilerini önceden doldurur.
							Bu adımı atlayıp bilgileri elle de girebilirsiniz.
						</p>
					</div>
					{loadingClients ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : (
						<ClientPickerCardList
							clients={clients}
							selectedId={clientId}
							onSelect={applyClient}
							emptyHint="Belgeleri önceden doldurabilmek için Müşteriler sayfasından müşteri ekleyin."
						/>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("property")}>← Geri</Button>
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => { applyClient(null); setStep("preview"); }}>Atla</Button>
							<Button onClick={() => setStep("preview")}>Devam →</Button>
						</div>
					</div>
				</div>
			)}

			{/* Step 4 fallback: a resumed draft re-fetches its property async —
			    show progress (or a recovery path) instead of a blank stage. */}
			{step === "preview" && !property && (
				loadingProperties || !propertiesLoaded ? (
					<div className="h-[40vh] flex items-center justify-center"><Spinner /></div>
				) : (
					<Alert
						action={<Button size="sm" onClick={() => setStep("property")}>Taşınmaz seç</Button>}
					>
						Seçilen taşınmaza artık ulaşılamıyor — bu arada kiralanmış veya satılmış olabilir.
						Lütfen yeniden seçim yapın.
					</Alert>
				)
			)}

			{/* Step 4: essentials panel + editor (merged stage) */}
			{step === "preview" && wizardData && (kind === "rental" || kind === "sales") && (
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3 flex-wrap">
						<div>
							<h2 className="font-display text-lg font-semibold text-base-content">Belgeyi düzenleyin</h2>
							<p className="text-sm text-base-content/60 mt-0.5">
								Metinlere ve kartlara tıklayarak düzenleyin — taraf, tutar ve tarih bilgileri belgeden alınır.
							</p>
						</div>
						{/* Edit / PDF preview toggle */}
						<div className="flex gap-1 rounded-xl bg-base-200 p-1" role="tablist" aria-label="Görünüm">
							{(["edit", "preview"] as const).map((m) => (
								<button
									key={m}
									type="button"
									role="tab"
									aria-selected={viewMode === m}
									onClick={() => switchMode(m)}
									className={cn(
										"px-3 h-9 rounded-lg text-sm font-medium transition-colors",
										viewMode === m
											? "bg-base-100 text-base-content shadow-sm"
											: "text-base-content/60 hover:text-base-content",
									)}
								>
									{m === "edit" ? "Düzenle" : "PDF Önizleme"}
								</button>
							))}
						</div>
					</div>

					{docStale && (
						<Alert
							tone="warning"
							action={<Button size="sm" onClick={rebuildFromData}>Belgeyi yeniden oluştur</Button>}
						>
							Bilgiler değişti ancak belgedeki özel düzenlemeleriniz korunduğu için uygulanmadı.
							Yeniden oluşturmak belgeyi yeni bilgilerle şablondan kurar ve düzenlemelerinizi siler.
						</Alert>
					)}

					{assetError ? (
						<Alert
							action={<Button size="sm" onClick={() => setAssetRetry((n) => n + 1)}>Yeniden dene</Button>}
						>
							Belge bileşenleri (yazı tipleri/marka) yüklenemedi: {assetError}
						</Alert>
					) : !fontsLoaded || !clausesReady || !docJson ? (
						<div className="h-[50vh] flex items-center justify-center"><Spinner /></div>
					) : viewMode === "edit" ? (
						<>
							{/* Cover fields — the cover page itself is generated, not block-edited. */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<FormField label="Belge başlığı">
									<Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
								</FormField>
								<FormField label="Kapak alt başlığı">
									<Input value={docSubtitle} onChange={(e) => setDocSubtitle(e.target.value)} />
								</FormField>
							</div>
							<div className="rounded-2xl bg-base-200 border border-base-300 px-3 sm:px-6 pt-2">
							<ContractEditor
								initialDoc={docJson}
								palette={previewBranding?.palette ?? DEFAULT_PALETTE}
								apiRef={editorApi}
								onChangeJson={(json) => setDocJson(json)}
								onDirty={() => setDocDirty(true)}
								onInvalidContent={() => {
									// Corrupt/outdated draft doc: drop it and let the
									// rebuild effect regenerate from the form data.
									setDocJson(null);
									setDocFingerprint(null);
									setDocDirty(false);
									setDocStale(false);
									toast.error("Kaydedilmiş belge okunamadı — bilgilerinizden yeniden oluşturuluyor.");
								}}
								onReset={() => setConfirmReset(true)}
							/>
							</div>
						</>
					) : (
						<div className="h-[60vh] sm:h-[72vh] bg-base-200 rounded-2xl overflow-hidden border border-base-300">
							{previewJson ? (
								<PDFBlobProvider
									document={
										<EditorPDFDocument
											kind={kind}
											title={docTitle.trim() || (kind === "rental" ? "Konut Kira Sözleşmesi" : "Satılık Alım, Satış Sözleşmesi")}
											subtitle={docSubtitle.trim() || null}
											doc={previewJson}
											sourceData={wizardData}
											branding={previewBranding}
										/>
									}
								>
									{({ url, loading, error: blobError }) => {
										if (loading || !url) {
											return (
												<div className="h-full flex items-center justify-center"><Spinner /></div>
											);
										}
										if (blobError) {
											return (
												<div className="h-full flex items-center justify-center text-sm text-error p-6">
													Önizleme oluşturulamadı: {String(blobError)}
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
							) : (
								<div className="h-full flex items-center justify-center"><Spinner /></div>
							)}
						</div>
					)}

					<div className="flex justify-between gap-2 pt-2">
						<Button
							variant="ghost"
							disabled={submitting}
							onClick={() => {
								const json = currentDocJson();
								if (json) setDocJson(json);
								setStep("client");
							}}
						>
							← Geri
						</Button>
						<Button
							onClick={handleConfirm}
							loading={submitting}
							disabled={!docJson}
							className="bg-success text-success-content hover:brightness-110 shadow-soft"
						>
							{submitting ? "Oluşturuluyor…" : "Onayla ve PDF oluştur"}
						</Button>
					</div>

					<ConfirmDialog
						open={confirmReset}
						title="Belge şablona sıfırlansın mı?"
						message="Bu adımda yaptığınız tüm metin ve blok değişiklikleri silinir; belge, girdiğiniz bilgiler ve ekip maddelerinizle yeniden oluşturulur."
						confirmLabel="Sıfırla"
						cancelLabel="Vazgeç"
						onConfirm={onResetConfirmed}
						onCancel={() => setConfirmReset(false)}
					/>
				</div>
			)}
		</div>
	);
}
