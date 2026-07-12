"use client";

import { useMemo } from "react";
import type { Property, TaxResponsibility } from "@/src/lib/db/types";
import { FormField, Input, NumberInput, EmailInput, PhoneInput, Textarea, Dropdown, type DropdownOption } from "@/src/components/ui";

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
	currency: "TRY",
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

const TAX_RESPONSIBILITY_OPTIONS: DropdownOption<TaxResponsibility>[] = [
	{ value: "buyer", label: "Alıcı tarafından" },
	{ value: "seller", label: "Satıcı tarafından" },
	{ value: "legal", label: "Yasal sorumluluklar çerçevesinde" },
];

interface Props {
	state: SalesFormState;
	onChange: <K extends keyof SalesFormState>(key: K, value: SalesFormState[K]) => void;
	/** Field-level validation errors, keyed by field name (see validateSales). */
	errors?: Record<string, string>;
}

/** Wizard-level validation for the sales details step. Keys map to FormField ids below. */
export function validateSales(s: SalesFormState): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!s.sellerName.trim()) errors.sellerName = "Satıcı adı zorunludur.";
	if (!s.buyerName.trim()) errors.buyerName = "Alıcı adı zorunludur.";
	if (!s.buyerPhone.trim() && !s.buyerEmail.trim())
		errors.buyerContact = "Alıcı için en az bir telefon veya e-posta girin.";
	if (!(Number(s.salePrice) > 0)) errors.salePrice = "Satış bedeli sıfırdan büyük olmalıdır.";
	if (s.saleDate.length !== 10) errors.saleDate = "Sözleşme tarihi zorunludur.";
	return errors;
}

function fmtMoney(n: number) {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
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

	// SalesFormState keeps numbers as strings (the wizard/PDF layer consumes
	// them with Number()); these adapt string-state ↔ NumberInput's number|null.
	const numValue = (k: keyof SalesFormState) => {
		const raw = state[k] as string;
		return raw === "" ? null : Number(raw);
	};
	const setNum = <K extends keyof SalesFormState>(k: K) =>
		(n: number | null) => onChange(k, (n === null ? "" : String(n)) as SalesFormState[K]);

	return (
		<div className="space-y-8">
			{/* A — Seller */}
			<section className="space-y-4">
				<h3 className="text-sm font-semibold text-base-content/60">
					A — Satıcı (Mal Sahibi)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma" id="sellerName" error={errors.sellerName}>
						<Input required value={state.sellerName} onChange={set("sellerName")} />
					</FormField>
					<FormField label="Telefon">
						<PhoneInput value={state.sellerPhone} onChange={(v) => onChange("sellerPhone", v)} />
					</FormField>
				</div>
				<FormField label="Adresi">
					<Input value={state.sellerAddress} onChange={set("sellerAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.sellerNationalId} onChange={set("sellerNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.sellerTaxNo} onChange={set("sellerTaxNo")} />
					</FormField>
					<FormField label="Vergi Dairesi">
						<Input value={state.sellerTaxOffice} onChange={set("sellerTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta">
					<EmailInput value={state.sellerEmail} onChange={(v) => onChange("sellerEmail", v)} />
				</FormField>
			</section>

			{/* B — Buyer */}
			<section className="space-y-4">
				<h3 className="text-sm font-semibold text-base-content/60">
					B — Alıcı
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma" id="buyerName" error={errors.buyerName}>
						<Input required value={state.buyerName} onChange={set("buyerName")} />
					</FormField>
					<FormField label="Telefon" id="buyerContact" error={errors.buyerContact}>
						<PhoneInput value={state.buyerPhone} onChange={(v) => onChange("buyerPhone", v)} />
					</FormField>
				</div>
				<FormField label="Adresi">
					<Input value={state.buyerAddress} onChange={set("buyerAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.buyerNationalId} onChange={set("buyerNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.buyerTaxNo} onChange={set("buyerTaxNo")} />
					</FormField>
					<FormField label="Vergi Dairesi">
						<Input value={state.buyerTaxOffice} onChange={set("buyerTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta">
					<EmailInput value={state.buyerEmail} onChange={(v) => onChange("buyerEmail", v)} />
				</FormField>
				<p className="text-xs text-base-content/50">Alıcı için en az bir e-posta veya telefon girin.</p>
			</section>

			{/* Sale info */}
			<section className="space-y-4">
				<h3 className="text-sm font-semibold text-base-content/60">
					Satış Bilgileri
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Satış Bedeli" id="salePrice" error={errors.salePrice}>
						<NumberInput required mode="decimal" format="money" min={0} value={numValue("salePrice")} onChange={setNum("salePrice")} />
					</FormField>
					<FormField label="Para Birimi">
						<Dropdown options={[{ value: "TRY", label: "TL" }]} value="TRY" onChange={() => {}} disabled />
					</FormField>
					<FormField label="Sözleşme Tarihi" id="saleDate" error={errors.saleDate}>
						<Input required type="date" value={state.saleDate} onChange={set("saleDate")} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Kapora">
						<NumberInput mode="decimal" format="money" min={0} value={numValue("depositAmount")} onChange={setNum("depositAmount")} />
					</FormField>
					<FormField label="Cezai Şart">
						<NumberInput mode="decimal" format="money" min={0} value={numValue("penaltyAmount")} onChange={setNum("penaltyAmount")} />
					</FormField>
					<FormField label="Tapu Devir Tarihi">
						<Input type="date" value={state.targetCloseDate} onChange={set("targetCloseDate")} />
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Protokol Süresi (gün)">
						<NumberInput min={0} value={numValue("validityDays")} onChange={setNum("validityDays")} />
					</FormField>
					<FormField label="Vergi Sorumluluğu">
						<Dropdown
							options={TAX_RESPONSIBILITY_OPTIONS}
							value={state.taxResponsibility}
							onChange={(v) => onChange("taxResponsibility", v)}
						/>
					</FormField>
				</div>
			</section>

			{/* Commission */}
			<section className="space-y-4">
				<h3 className="text-sm font-semibold text-base-content/60">
					Komisyon
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Alıcı Hizmet Bedeli Oranı %">
						<NumberInput mode="decimal" min={0} max={100} value={numValue("buyerCommissionRate")} onChange={setNum("buyerCommissionRate")} />
					</FormField>
					<FormField label="Satıcı Hizmet Bedeli Oranı %">
						<NumberInput mode="decimal" min={0} max={100} value={numValue("sellerCommissionRate")} onChange={setNum("sellerCommissionRate")} />
					</FormField>
				</div>
				{(commissionPreview.buyer || commissionPreview.seller) && (
					<div className="rounded-xl bg-base-200 border border-base-300 p-3.5 text-sm text-base-content/70 space-y-1.5">
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
				<h3 className="text-sm font-semibold text-base-content/60">
					Özel Şartlar
				</h3>
				<FormField label="Özel Şartlar — opsiyonel">
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
