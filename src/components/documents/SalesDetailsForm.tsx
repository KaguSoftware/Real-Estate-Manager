"use client";

import { useMemo } from "react";
import type { Property, TaxResponsibility } from "@/src/lib/db/types";
import { FormField, Input, Textarea, Select } from "@/src/components/ui";

/**
 * State container for the sales wizard step 3.
 * Caller owns useState and passes setters in. Keeps this component
 * fully controlled and easy to wire into the wizard's preview step.
 */
export interface SalesFormState {
	// Seller (mal sahibi)
	sellerName: string;
	sellerAddress: string;
	sellerNationalId: string;
	sellerTaxNo: string;
	sellerTaxOffice: string;
	sellerPhone: string;
	sellerEmail: string;
	// Buyer (alıcı)
	buyerName: string;
	buyerAddress: string;
	buyerNationalId: string;
	buyerTaxNo: string;
	buyerTaxOffice: string;
	buyerPhone: string;
	buyerEmail: string;
	// Sale
	salePrice: string;
	currency: string;
	saleDate: string;
	targetCloseDate: string;
	depositAmount: string;
	penaltyAmount: string;
	validityDays: string;
	taxResponsibility: TaxResponsibility;
	// Commission rates (%)
	buyerCommissionRate: string;
	sellerCommissionRate: string;
	// Free text
	specialConditions: string;
}

export const initialSalesFormState = (property: Property | null): SalesFormState => ({
	sellerName: property?.homeowner_name ?? "",
	sellerAddress: property
		? [property.address_line, property.city].filter(Boolean).join(", ")
		: "",
	sellerNationalId: "",
	sellerTaxNo: "",
	sellerTaxOffice: "",
	sellerPhone: "",
	sellerEmail: "",
	buyerName: "",
	buyerAddress: "",
	buyerNationalId: "",
	buyerTaxNo: "",
	buyerTaxOffice: "",
	buyerPhone: "",
	buyerEmail: "",
	salePrice: property?.list_price?.toString() ?? "",
	currency: property?.currency ?? "USD",
	saleDate: new Date().toISOString().slice(0, 10),
	targetCloseDate: "",
	depositAmount: "",
	penaltyAmount: "",
	validityDays: "30",
	taxResponsibility: "legal",
	buyerCommissionRate: "2",
	sellerCommissionRate: "2",
	specialConditions: "",
});

interface Props {
	state: SalesFormState;
	onChange: <K extends keyof SalesFormState>(key: K, value: SalesFormState[K]) => void;
	/** Field-level validation errors, keyed by field name (see validateSales). */
	errors?: Record<string, string>;
}

/** Wizard-level validation for the sales details step. Keys map to FormField ids below. */
export function validateSales(s: SalesFormState): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!s.sellerName.trim()) errors.sellerName = "Seller name is required.";
	if (!s.buyerName.trim()) errors.buyerName = "Buyer name is required.";
	if (!s.buyerPhone.trim() && !s.buyerEmail.trim())
		errors.buyerContact = "Provide at least a phone or an email for the buyer.";
	if (!(Number(s.salePrice) > 0)) errors.salePrice = "Sale price must be greater than zero.";
	if (s.saleDate.length !== 10) errors.saleDate = "Sale date is required.";
	return errors;
}

function fmtMoney(n: number) {
	return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function SalesDetailsForm({ state, onChange, errors = {} }: Props) {
	const salePrice = Number(state.salePrice || 0);
	const buyerRate  = Number(state.buyerCommissionRate || 0);
	const sellerRate = Number(state.sellerCommissionRate || 0);

	const commissionPreview = useMemo(() => {
		function line(rate: number) {
			if (!rate || !salePrice) return null;
			const matrah = salePrice * rate / 100;
			const kdv = matrah * 0.18;
			const total = matrah + kdv;
			return { matrah, kdv, total };
		}
		return { buyer: line(buyerRate), seller: line(sellerRate) };
	}, [salePrice, buyerRate, sellerRate]);

	const set = <K extends keyof SalesFormState>(k: K) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
			onChange(k, e.target.value as SalesFormState[K]);

	return (
		<div className="space-y-8">
			{/* A — Seller */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					A — Mal Sahibi (Seller)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)" id="sellerName" error={errors.sellerName}>
						<Input required value={state.sellerName} onChange={set("sellerName")} />
					</FormField>
					<FormField label="Telefon (Phone)">
						<Input type="tel" inputMode="tel" value={state.sellerPhone} onChange={set("sellerPhone")} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<Input value={state.sellerAddress} onChange={set("sellerAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.sellerNationalId} onChange={set("sellerNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.sellerTaxNo} onChange={set("sellerTaxNo")} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<Input value={state.sellerTaxOffice} onChange={set("sellerTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<Input type="email" value={state.sellerEmail} onChange={set("sellerEmail")} />
				</FormField>
			</section>

			{/* B — Buyer */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					B — Alıcı (Buyer)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)" id="buyerName" error={errors.buyerName}>
						<Input required value={state.buyerName} onChange={set("buyerName")} />
					</FormField>
					<FormField label="Telefon (Phone)" id="buyerContact" error={errors.buyerContact}>
						<Input type="tel" inputMode="tel" value={state.buyerPhone} onChange={set("buyerPhone")} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<Input value={state.buyerAddress} onChange={set("buyerAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.buyerNationalId} onChange={set("buyerNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.buyerTaxNo} onChange={set("buyerTaxNo")} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<Input value={state.buyerTaxOffice} onChange={set("buyerTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<Input type="email" value={state.buyerEmail} onChange={set("buyerEmail")} />
				</FormField>
				<p className="text-xs text-slate-400">Provide at least an email or phone for the buyer.</p>
			</section>

			{/* Sale info */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Satış Bilgileri (Sale info)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Satış Bedeli (Sale price)" id="salePrice" error={errors.salePrice}>
						<Input required type="number" inputMode="decimal" min="0" step="0.01" value={state.salePrice} onChange={set("salePrice")} />
					</FormField>
					<FormField label="Para Birimi (Currency)">
						<Select value={state.currency} onChange={set("currency")}>
							<option value="USD">USD ($)</option>
							<option value="TRY">TRY (₺)</option>
							<option value="EUR">EUR (€)</option>
						</Select>
					</FormField>
					<FormField label="Sözleşme Tarihi (Sale date)" id="saleDate" error={errors.saleDate}>
						<Input required type="date" value={state.saleDate} onChange={set("saleDate")} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Kapora (Deposit)">
						<Input type="number" inputMode="decimal" min="0" step="0.01" value={state.depositAmount} onChange={set("depositAmount")} />
					</FormField>
					<FormField label="Cezai Şart (Penalty)">
						<Input type="number" inputMode="decimal" min="0" step="0.01" value={state.penaltyAmount} onChange={set("penaltyAmount")} />
					</FormField>
					<FormField label="Tapu Devir Tarihi (Target close date)">
						<Input type="date" value={state.targetCloseDate} onChange={set("targetCloseDate")} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Protokol Süresi / gün (Validity days)">
						<Input type="number" inputMode="numeric" min="0" step="1" value={state.validityDays} onChange={set("validityDays")} />
					</FormField>
					<FormField label="Vergi Sorumluluğu (Tax responsibility)">
						<Select value={state.taxResponsibility} onChange={set("taxResponsibility")}>
							<option value="buyer">Alıcı tarafından (Buyer pays)</option>
							<option value="seller">Satıcı tarafından (Seller pays)</option>
							<option value="legal">Yasal sorumluluklar çerçevesinde (Legal)</option>
						</Select>
					</FormField>
				</div>
			</section>

			{/* Commission */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Komisyon (Commission)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Alıcı Hizmet Bedeli Oranı % (Buyer rate)">
						<Input type="number" inputMode="decimal" min="0" step="0.01" value={state.buyerCommissionRate} onChange={set("buyerCommissionRate")} />
					</FormField>
					<FormField label="Satıcı Hizmet Bedeli Oranı % (Seller rate)">
						<Input type="number" inputMode="decimal" min="0" step="0.01" value={state.sellerCommissionRate} onChange={set("sellerCommissionRate")} />
					</FormField>
				</div>
				{(commissionPreview.buyer || commissionPreview.seller) && (
					<div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-sm text-slate-600 space-y-1.5">
						{commissionPreview.buyer && (
							<p><span className="font-bold">Alıcı:</span> matrah {fmtMoney(commissionPreview.buyer.matrah)} {state.currency}
								{" · "}KDV {fmtMoney(commissionPreview.buyer.kdv)}
								{" · "}toplam {fmtMoney(commissionPreview.buyer.total)} {state.currency}</p>
						)}
						{commissionPreview.seller && (
							<p><span className="font-bold">Satıcı:</span> matrah {fmtMoney(commissionPreview.seller.matrah)} {state.currency}
								{" · "}KDV {fmtMoney(commissionPreview.seller.kdv)}
								{" · "}toplam {fmtMoney(commissionPreview.seller.total)} {state.currency}</p>
						)}
					</div>
				)}
			</section>

			{/* Special conditions */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Özel Şartlar (Special conditions)
				</h3>
				<FormField label="Özel Şartlar — optional, free text">
					<Textarea rows={4} value={state.specialConditions} onChange={set("specialConditions")} />
				</FormField>
			</section>
		</div>
	);
}

/** Compute the commission lines for the PDF from rates + sale price. */
export function computeCommission(salePrice: number, rate: number | null) {
	if (!rate || !salePrice) {
		return { rate: rate ?? null, matrah: null, kdv: null, total: null };
	}
	const matrah = salePrice * rate / 100;
	const kdv = matrah * 0.18;
	return { rate, matrah, kdv, total: matrah + kdv };
}
