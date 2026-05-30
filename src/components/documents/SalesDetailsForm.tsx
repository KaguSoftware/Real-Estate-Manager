"use client";

import { useMemo } from "react";
import type { Property, TaxResponsibility } from "@/src/lib/db/types";
import { FormField, inputClass } from "@/src/components/ui/FormField";

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
}

function fmtMoney(n: number) {
	return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function SalesDetailsForm({ state, onChange }: Props) {
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
				<h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
					A — Mal Sahibi (Seller)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)">
						<input required value={state.sellerName} onChange={set("sellerName")} className={inputClass} />
					</FormField>
					<FormField label="Telefon (Phone)">
						<input value={state.sellerPhone} onChange={set("sellerPhone")} className={inputClass} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<input value={state.sellerAddress} onChange={set("sellerAddress")} className={inputClass} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<input value={state.sellerNationalId} onChange={set("sellerNationalId")} className={inputClass} />
					</FormField>
					<FormField label="Vergi No">
						<input value={state.sellerTaxNo} onChange={set("sellerTaxNo")} className={inputClass} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<input value={state.sellerTaxOffice} onChange={set("sellerTaxOffice")} className={inputClass} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<input type="email" value={state.sellerEmail} onChange={set("sellerEmail")} className={inputClass} />
				</FormField>
			</section>

			{/* B — Buyer */}
			<section className="space-y-4">
				<h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
					B — Alıcı (Buyer)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)">
						<input required value={state.buyerName} onChange={set("buyerName")} className={inputClass} />
					</FormField>
					<FormField label="Telefon (Phone)">
						<input value={state.buyerPhone} onChange={set("buyerPhone")} className={inputClass} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<input value={state.buyerAddress} onChange={set("buyerAddress")} className={inputClass} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<input value={state.buyerNationalId} onChange={set("buyerNationalId")} className={inputClass} />
					</FormField>
					<FormField label="Vergi No">
						<input value={state.buyerTaxNo} onChange={set("buyerTaxNo")} className={inputClass} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<input value={state.buyerTaxOffice} onChange={set("buyerTaxOffice")} className={inputClass} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<input type="email" value={state.buyerEmail} onChange={set("buyerEmail")} className={inputClass} />
				</FormField>
				<p className="text-[11px] text-slate-400">Provide at least an email or phone for the buyer.</p>
			</section>

			{/* Sale info */}
			<section className="space-y-4">
				<h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
					Satış Bilgileri (Sale info)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Satış Bedeli (Sale price)">
						<input required type="number" min="0" step="0.01" value={state.salePrice}
							onChange={set("salePrice")} className={inputClass} />
					</FormField>
					<FormField label="Para Birimi (Currency)">
						<select value={state.currency} onChange={set("currency")} className={inputClass}>
							<option value="USD">USD ($)</option>
							<option value="TRY">TRY (₺)</option>
							<option value="EUR">EUR (€)</option>
						</select>
					</FormField>
					<FormField label="Sözleşme Tarihi (Sale date)">
						<input required type="date" value={state.saleDate} onChange={set("saleDate")} className={inputClass} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Kapora (Deposit)">
						<input type="number" min="0" step="0.01" value={state.depositAmount}
							onChange={set("depositAmount")} className={inputClass} />
					</FormField>
					<FormField label="Cezai Şart (Penalty)">
						<input type="number" min="0" step="0.01" value={state.penaltyAmount}
							onChange={set("penaltyAmount")} className={inputClass} />
					</FormField>
					<FormField label="Tapu Devir Tarihi (Target close date)">
						<input type="date" value={state.targetCloseDate} onChange={set("targetCloseDate")} className={inputClass} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Protokol Süresi / gün (Validity days)">
						<input type="number" min="0" step="1" value={state.validityDays}
							onChange={set("validityDays")} className={inputClass} />
					</FormField>
					<FormField label="Vergi Sorumluluğu (Tax responsibility)">
						<select value={state.taxResponsibility} onChange={set("taxResponsibility")} className={inputClass}>
							<option value="buyer">Alıcı tarafından (Buyer pays)</option>
							<option value="seller">Satıcı tarafından (Seller pays)</option>
							<option value="legal">Yasal sorumluluklar çerçevesinde (Legal)</option>
						</select>
					</FormField>
				</div>
			</section>

			{/* Commission */}
			<section className="space-y-4">
				<h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
					Komisyon (Commission)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Alıcı Hizmet Bedeli Oranı % (Buyer rate)">
						<input type="number" min="0" step="0.01" value={state.buyerCommissionRate}
							onChange={set("buyerCommissionRate")} className={inputClass} />
					</FormField>
					<FormField label="Satıcı Hizmet Bedeli Oranı % (Seller rate)">
						<input type="number" min="0" step="0.01" value={state.sellerCommissionRate}
							onChange={set("sellerCommissionRate")} className={inputClass} />
					</FormField>
				</div>
				{(commissionPreview.buyer || commissionPreview.seller) && (
					<div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
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
				<h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
					Özel Şartlar (Special conditions)
				</h3>
				<FormField label="Özel Şartlar — optional, free text">
					<textarea rows={4} value={state.specialConditions}
						onChange={set("specialConditions")} className={inputClass} />
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
