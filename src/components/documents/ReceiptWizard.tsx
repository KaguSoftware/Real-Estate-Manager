"use client";

// Kira makbuzu flow for /documents/new: pick a leased property → pick the
// lease/tenant (skipped when there is only one) → pick a recorded payment →
// confirm and download the PDF. Rendered by DocumentWizard when the user
// chooses "Kira Makbuzu" on the type step; kept separate so the (much larger)
// rental/sales contract wizard stays untouched.

import { humanizeError } from "@/src/lib/errors";
import { useCallback, useEffect, useState } from "react";
import { listEligiblePropertiesForDocType } from "@/src/lib/db/properties";
import { listLeasesForProperty } from "@/src/lib/db/leases";
import { listPaymentsForLease } from "@/src/lib/db/payments";
import { exportToPDF, getPdfBrandingFromStore } from "@/src/lib/pdf";
import { buildReceiptPDFData, receiptFilename } from "@/src/lib/pdf/receiptData";
import { fmtMoney } from "@/src/lib/format";
import type { Lease, Payment, Property, Tenant } from "@/src/lib/db/types";
import { PropertyPickerCardList } from "./PropertyPickerCardList";
import { Badge, Button, cn, Spinner, toast } from "@/src/components/ui";

type Step = "property" | "lease" | "payment" | "confirm";

const STEPS: Step[] = ["property", "lease", "payment", "confirm"];

const STEP_LABELS: Record<Step, string> = {
	property: "Taşınmaz",
	lease: "Kiracı",
	payment: "Ödeme",
	confirm: "Onay",
};

type LeaseWithTenant = Lease & { tenant: Tenant | null };

const LEASE_STATUS_LABEL: Record<string, string> = {
	active: "Etkin",
	ended: "Sona erdi",
	cancelled: "İptal edildi",
};

function fmtDate(iso: string | null): string {
	return iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";
}

function isPaid(p: Payment): boolean {
	return Number(p.amount_paid) >= Number(p.amount_due) && Number(p.amount_due) > 0;
}

interface Props {
	/** Back out of the receipt flow to the wizard's type-selection step. */
	onExit: () => void;
}

export function ReceiptWizard({ onExit }: Props) {
	const [step, setStep] = useState<Step>("property");

	const [properties, setProperties] = useState<Property[]>([]);
	const [loadingProperties, setLoadingProperties] = useState(true);
	const [propertyId, setPropertyId] = useState<string | null>(null);
	const property = properties.find((p) => p.id === propertyId) ?? null;

	const [leases, setLeases] = useState<LeaseWithTenant[]>([]);
	const [loadingLeases, setLoadingLeases] = useState(false);
	const [leaseId, setLeaseId] = useState<string | null>(null);
	const lease = leases.find((l) => l.id === leaseId) ?? null;

	const [payments, setPayments] = useState<Payment[]>([]);
	const [loadingPayments, setLoadingPayments] = useState(false);
	const [paymentId, setPaymentId] = useState<string | null>(null);
	const payment = payments.find((p) => p.id === paymentId) ?? null;

	const [generating, setGenerating] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const props = await listEligiblePropertiesForDocType("receipt");
				if (!cancelled) setProperties(props);
			} catch (e) {
				if (!cancelled) toast.error(humanizeError(e));
			} finally {
				if (!cancelled) setLoadingProperties(false);
			}
		})();
		return () => { cancelled = true; };
	}, []);

	/** Load leases for the chosen property; skip the lease step when there is
	 *  exactly one candidate (defaulting to the active lease otherwise). */
	const goToLeases = useCallback(async () => {
		if (!propertyId) return;
		setLoadingLeases(true);
		setStep("lease");
		try {
			const rows = (await listLeasesForProperty(propertyId)).filter((l) => l.tenant);
			setLeases(rows);
			const active = rows.find((l) => l.status === "active") ?? null;
			if (rows.length === 1) {
				setLeaseId(rows[0].id);
			} else {
				setLeaseId(active?.id ?? null);
			}
		} catch (e) {
			toast.error(humanizeError(e));
			setStep("property");
		} finally {
			setLoadingLeases(false);
		}
	}, [propertyId]);

	const goToPayments = useCallback(async (id: string) => {
		setLoadingPayments(true);
		setStep("payment");
		setPaymentId(null);
		try {
			setPayments(await listPaymentsForLease(id));
		} catch (e) {
			toast.error(humanizeError(e));
			setStep("lease");
		} finally {
			setLoadingPayments(false);
		}
	}, []);

	// Single-lease properties skip the picker straight to payments.
	useEffect(() => {
		if (step === "lease" && !loadingLeases && leases.length === 1 && leaseId) {
			goToPayments(leaseId);
		}
	}, [step, loadingLeases, leases.length, leaseId, goToPayments]);

	async function handleGenerate() {
		if (!property || !lease?.tenant || !payment) return;
		setGenerating(true);
		try {
			const data = buildReceiptPDFData(property, lease, lease.tenant, payment);
			await exportToPDF("receipt", data, receiptFilename(payment), await getPdfBrandingFromStore());
			// Not archived: saveDocumentPdf stores one PDF per lease/sale at
			// {team_id}/{record_id}.pdf and links leases.document_pdf_path —
			// uploading a receipt there would overwrite the lease's contract PDF,
			// and contract_documents is rental/sales-only. Receipts stay
			// download-only, same as the property-detail flow.
			toast.success("Kira makbuzu oluşturuldu ve indirildi.");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setGenerating(false);
		}
	}

	const stepIndex = STEPS.indexOf(step);

	return (
		<div>
			{/* Stepper — same visual language as the contract wizard's. */}
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

			{/* Step 1: property with a lease */}
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
							emptyHint="Makbuz yalnızca kira sözleşmesi bulunan taşınmazlar için oluşturulabilir."
						/>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={onExit}>← Geri</Button>
						<Button onClick={goToLeases} disabled={!propertyId}>Devam →</Button>
					</div>
				</div>
			)}

			{/* Step 2: lease/tenant (auto-skipped when only one lease exists) */}
			{step === "lease" && (
				<div className="space-y-4">
					<h2 className="font-display text-lg font-semibold text-base-content">Kiracı seçin</h2>
					{loadingLeases ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : leases.length === 0 ? (
						<div className="text-center py-12 bg-base-200 rounded-2xl border border-dashed border-base-300">
							<p className="text-sm text-base-content/60">Bu taşınmaz için kayıtlı kira sözleşmesi bulunamadı.</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{leases.map((l) => {
								const selected = l.id === leaseId;
								return (
									<button
										key={l.id}
										type="button"
										onClick={() => setLeaseId(l.id)}
										className={cn(
											"text-left p-4 rounded-2xl border transition-all shadow-soft",
											selected
												? "border-primary bg-primary/5 ring-2 ring-primary/20"
												: "border-base-300 bg-base-100 hover:border-base-content/30 active:bg-base-200",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<p className="text-sm font-bold text-base-content truncate">{l.tenant?.full_name ?? "—"}</p>
											<Badge tone={l.status === "active" ? "emerald" : "slate"}>
												{LEASE_STATUS_LABEL[l.status] ?? l.status}
											</Badge>
										</div>
										<p className="text-sm text-base-content/60 mt-1">
											{fmtDate(l.start_date)} → {l.end_date ? fmtDate(l.end_date) : "süresiz"}
										</p>
										<p className="text-sm font-semibold text-base-content/80 mt-1 font-numeric">
											{fmtMoney(Number(l.monthly_rent), l.currency)} / ay
										</p>
									</button>
								);
							})}
						</div>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("property")}>← Geri</Button>
						<Button onClick={() => leaseId && goToPayments(leaseId)} disabled={!leaseId}>Devam →</Button>
					</div>
				</div>
			)}

			{/* Step 3: payment */}
			{step === "payment" && (
				<div className="space-y-4">
					<h2 className="font-display text-lg font-semibold text-base-content">Ödeme seçin</h2>
					{loadingPayments ? (
						<div className="flex justify-center py-8"><Spinner size="sm" /></div>
					) : payments.length === 0 ? (
						<div className="text-center py-12 bg-base-200 rounded-2xl border border-dashed border-base-300">
							<p className="text-sm text-base-content/60 mb-1">Bu kira sözleşmesi için kayıtlı ödeme yok.</p>
							<p className="text-xs text-base-content/50 px-6">
								Önce taşınmaz sayfasındaki Ödemeler listesinden bir ödeme kaydedin.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{payments.map((p) => {
								const selected = p.id === paymentId;
								const paid = isPaid(p);
								return (
									<button
										key={p.id}
										type="button"
										onClick={() => setPaymentId(p.id)}
										className={cn(
											"text-left p-4 rounded-2xl border transition-all shadow-soft",
											selected
												? "border-primary bg-primary/5 ring-2 ring-primary/20"
												: "border-base-300 bg-base-100 hover:border-base-content/30 active:bg-base-200",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<p className="text-sm font-bold text-base-content">
												{fmtDate(p.period_start)} → {fmtDate(p.period_end)}
											</p>
											<Badge tone={paid ? "emerald" : "amber"}>{paid ? "Ödendi" : "Eksik"}</Badge>
										</div>
										<p className="text-sm font-semibold text-base-content/80 mt-1 font-numeric">
											{fmtMoney(Number(p.amount_paid), lease?.currency ?? "TRY")}
										</p>
										<p className="text-xs text-base-content/50 mt-0.5">
											Ödeme tarihi: {fmtDate(p.paid_at)}
										</p>
									</button>
								);
							})}
						</div>
					)}
					<div className="flex justify-between gap-2 pt-4">
						<Button
							variant="ghost"
							onClick={() => (leases.length > 1 ? setStep("lease") : setStep("property"))}
						>← Geri</Button>
						<Button onClick={() => setStep("confirm")} disabled={!paymentId}>Devam →</Button>
					</div>
				</div>
			)}

			{/* Step 4: confirm + generate */}
			{step === "confirm" && property && lease && payment && (
				<div className="space-y-4">
					<h2 className="font-display text-lg font-semibold text-base-content">Makbuzu onaylayın</h2>
					<div className="p-5 rounded-2xl border border-base-300 bg-base-100 shadow-soft space-y-3">
						<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Kiraya veren</dt>
								<dd className="text-base-content font-semibold mt-0.5">{property.homeowner_name}</dd>
							</div>
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Kiracı</dt>
								<dd className="text-base-content font-semibold mt-0.5">{lease.tenant?.full_name ?? "—"}</dd>
							</div>
							<div className="sm:col-span-2">
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Taşınmaz</dt>
								<dd className="text-base-content mt-0.5">
									{property.address_line}{property.city ? `, ${property.city}` : ""}
								</dd>
							</div>
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Dönem</dt>
								<dd className="text-base-content mt-0.5">{fmtDate(payment.period_start)} → {fmtDate(payment.period_end)}</dd>
							</div>
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Tutar</dt>
								<dd className="text-base-content font-semibold font-numeric mt-0.5">
									{fmtMoney(Number(payment.amount_paid), lease.currency)}
								</dd>
							</div>
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Ödeme tarihi</dt>
								<dd className="text-base-content mt-0.5">{fmtDate(payment.paid_at)}</dd>
							</div>
							<div>
								<dt className="text-base-content/50 text-xs font-semibold uppercase tracking-wide">Yöntem</dt>
								<dd className="text-base-content mt-0.5">{payment.method ?? "—"}</dd>
							</div>
						</dl>
					</div>
					<div className="flex justify-between gap-2 pt-4">
						<Button variant="ghost" onClick={() => setStep("payment")} disabled={generating}>← Geri</Button>
						<Button onClick={handleGenerate} loading={generating}>Makbuzu indir (PDF)</Button>
					</div>
				</div>
			)}
		</div>
	);
}
