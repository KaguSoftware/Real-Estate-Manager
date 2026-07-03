"use client";

import type {
	InventoryItem,
	LeaseTerm,
	Property,
	UtilityResponsibility,
} from "@/src/lib/db/types";
import { FormField, Input, Textarea, Select, Button } from "@/src/components/ui";

/**
 * State container for the rental wizard details step (Turkish kira sözleşmesi).
 * Caller owns useState and passes an onChange patcher in, mirroring
 * SalesDetailsForm so the wizard wires both the same way.
 */
export interface RentalFormState {
	// Kiraya Veren (landlord)
	landlordName: string;
	landlordAddress: string;
	landlordNationalId: string;
	landlordTaxNo: string;
	landlordTaxOffice: string;
	landlordPhone: string;
	landlordEmail: string;
	// Kiracı (tenant)
	tenantName: string;
	tenantAddress: string;
	tenantNationalId: string;
	tenantTaxNo: string;
	tenantTaxOffice: string;
	tenantPhone: string;
	tenantEmail: string;
	// Kefil (guarantor) — optional
	guarantorEnabled: boolean;
	guarantorName: string;
	guarantorAddress: string;
	guarantorNationalId: string;
	guarantorPhone: string;
	guarantorEmail: string;
	// Lease
	term: LeaseTerm;
	startDate: string;
	currency: string;
	monthlyRent: string;
	deposit: string;
	paymentDay: string;
	paymentMethod: string;
	bankAccount: string;
	// Utilities
	utilElectricity: UtilityResponsibility;
	utilWater: UtilityResponsibility;
	utilGas: UtilityResponsibility;
	utilInternet: UtilityResponsibility;
	utilAidat: UtilityResponsibility;
	// Misc
	sublettingAllowed: boolean;
	rentIncreaseNote: string;
	inventory: InventoryItem[];
	conditionNotes: string;
	specialConditions: string;
}

export const initialRentalFormState = (property: Property | null): RentalFormState => ({
	landlordName: property?.homeowner_name ?? "",
	landlordAddress: property
		? [property.address_line, property.city].filter(Boolean).join(", ")
		: "",
	landlordNationalId: "",
	landlordTaxNo: "",
	landlordTaxOffice: "",
	landlordPhone: "",
	landlordEmail: "",
	tenantName: "",
	tenantAddress: "",
	tenantNationalId: "",
	tenantTaxNo: "",
	tenantTaxOffice: "",
	tenantPhone: "",
	tenantEmail: "",
	guarantorEnabled: false,
	guarantorName: "",
	guarantorAddress: "",
	guarantorNationalId: "",
	guarantorPhone: "",
	guarantorEmail: "",
	term: "1yr",
	startDate: new Date().toISOString().slice(0, 10),
	currency: property?.currency ?? "TRY",
	monthlyRent: property?.list_price?.toString() ?? "",
	deposit: "0",
	paymentDay: "1",
	paymentMethod: "Banka havalesi",
	bankAccount: "",
	utilElectricity: "tenant",
	utilWater: "tenant",
	utilGas: "tenant",
	utilInternet: "tenant",
	utilAidat: "tenant",
	sublettingAllowed: false,
	rentIncreaseNote: "",
	inventory: [],
	conditionNotes: "",
	specialConditions: "",
});

/** True when the deposit exceeds the TBK m.342 cap of three months' rent. */
export function computeDepositOverCap(deposit: number, monthlyRent: number) {
	return monthlyRent > 0 && deposit > monthlyRent * 3;
}

interface Props {
	state: RentalFormState;
	onChange: <K extends keyof RentalFormState>(key: K, value: RentalFormState[K]) => void;
	/** Field-level validation errors, keyed by field name (see validateRental). */
	errors?: Record<string, string>;
}

const UTILITY_OPTIONS: { value: UtilityResponsibility; label: string }[] = [
	{ value: "tenant", label: "Kiracı (Tenant)" },
	{ value: "landlord", label: "Kiraya Veren (Landlord)" },
	{ value: "shared", label: "Ortak (Shared)" },
];

function UtilitySelect({
	label,
	value,
	onChange,
}: {
	label: string;
	value: UtilityResponsibility;
	onChange: (v: UtilityResponsibility) => void;
}) {
	return (
		<FormField label={label}>
			<Select value={value} onChange={(e) => onChange(e.target.value as UtilityResponsibility)}>
				{UTILITY_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</Select>
		</FormField>
	);
}

/** Wizard-level validation for the rental details step. Keys map to FormField ids below. */
export function validateRental(s: RentalFormState): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!s.landlordName.trim()) errors.landlordName = "Landlord name is required.";
	if (!s.tenantName.trim()) errors.tenantName = "Tenant name is required.";
	if (!s.tenantPhone.trim() && !s.tenantEmail.trim())
		errors.tenantContact = "Provide at least a phone or an email for the tenant.";
	if (!(Number(s.monthlyRent) > 0)) errors.monthlyRent = "Monthly rent must be greater than zero.";
	if (s.startDate.length !== 10) errors.startDate = "Start date is required.";
	return errors;
}

export function RentalDetailsForm({ state, onChange, errors = {} }: Props) {
	const monthlyRent = Number(state.monthlyRent || 0);
	const deposit = Number(state.deposit || 0);
	const overCap = computeDepositOverCap(deposit, monthlyRent);

	const set = <K extends keyof RentalFormState>(k: K) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
			onChange(k, e.target.value as RentalFormState[K]);

	// ── Inventory row helpers ──────────────────────────────────────────────
	function patchInventory(next: InventoryItem[]) {
		onChange("inventory", next);
	}
	function addInventoryRow() {
		patchInventory([...state.inventory, { item: "", qty: null, note: null }]);
	}
	function updateInventoryRow(idx: number, patch: Partial<InventoryItem>) {
		patchInventory(state.inventory.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
	}
	function removeInventoryRow(idx: number) {
		patchInventory(state.inventory.filter((_, i) => i !== idx));
	}

	return (
		<div className="space-y-8">
			{/* A — Landlord */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					A — Kiraya Veren (Landlord)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)" id="landlordName" error={errors.landlordName}>
						<Input required value={state.landlordName} onChange={set("landlordName")} />
					</FormField>
					<FormField label="Telefon (Phone)">
						<Input type="tel" inputMode="tel" value={state.landlordPhone} onChange={set("landlordPhone")} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<Input value={state.landlordAddress} onChange={set("landlordAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.landlordNationalId} onChange={set("landlordNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.landlordTaxNo} onChange={set("landlordTaxNo")} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<Input value={state.landlordTaxOffice} onChange={set("landlordTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<Input type="email" value={state.landlordEmail} onChange={set("landlordEmail")} />
				</FormField>
			</section>

			{/* B — Tenant */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					B — Kiracı (Tenant)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Adı Soyadı / Firma (Full name)" id="tenantName" error={errors.tenantName}>
						<Input required value={state.tenantName} onChange={set("tenantName")} />
					</FormField>
					<FormField label="Telefon (Phone)" id="tenantContact" error={errors.tenantContact}>
						<Input type="tel" inputMode="tel" value={state.tenantPhone} onChange={set("tenantPhone")} />
					</FormField>
				</div>
				<FormField label="Adresi (Address)">
					<Input value={state.tenantAddress} onChange={set("tenantAddress")} />
				</FormField>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="T.C. Kimlik No">
						<Input value={state.tenantNationalId} onChange={set("tenantNationalId")} />
					</FormField>
					<FormField label="Vergi No">
						<Input value={state.tenantTaxNo} onChange={set("tenantTaxNo")} />
					</FormField>
					<FormField label="V. Dairesi (Tax office)">
						<Input value={state.tenantTaxOffice} onChange={set("tenantTaxOffice")} />
					</FormField>
				</div>
				<FormField label="E-posta (Email)">
					<Input type="email" value={state.tenantEmail} onChange={set("tenantEmail")} />
				</FormField>
				<p className="text-xs text-slate-400">Provide at least an email or phone for the tenant.</p>
			</section>

			{/* C — Guarantor (optional) */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
						C — Kefil (Guarantor)
					</h3>
					<label className="flex items-center gap-2 text-sm text-slate-600">
						<input
							type="checkbox"
							checked={state.guarantorEnabled}
							onChange={(e) => onChange("guarantorEnabled", e.target.checked)}
							className="h-4 w-4 rounded border-slate-300"
						/>
						Kefil ekle (add guarantor)
					</label>
				</div>
				{state.guarantorEnabled && (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<FormField label="Adı Soyadı (Full name)">
								<Input value={state.guarantorName} onChange={set("guarantorName")} />
							</FormField>
							<FormField label="Telefon (Phone)">
								<Input type="tel" inputMode="tel" value={state.guarantorPhone} onChange={set("guarantorPhone")} />
							</FormField>
						</div>
						<FormField label="Adresi (Address)">
							<Input value={state.guarantorAddress} onChange={set("guarantorAddress")} />
						</FormField>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<FormField label="T.C. Kimlik No">
								<Input value={state.guarantorNationalId} onChange={set("guarantorNationalId")} />
							</FormField>
							<FormField label="E-posta (Email)">
								<Input type="email" value={state.guarantorEmail} onChange={set("guarantorEmail")} />
							</FormField>
						</div>
					</>
				)}
			</section>

			{/* E — Lease & term */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Kira ve Süre (Lease &amp; term)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Süre (Term)">
						<Select value={state.term} onChange={set("term")}>
							<option value="1yr">1 yıl (1 year)</option>
							<option value="2yr">2 yıl (2 years)</option>
							<option value="undefined">Belirsiz (Undefined)</option>
						</Select>
					</FormField>
					<FormField label="Başlangıç (Start date)" id="startDate" error={errors.startDate}>
						<Input required type="date" value={state.startDate} onChange={set("startDate")} />
					</FormField>
					<FormField label="Para Birimi (Currency)">
						<Select value={state.currency} onChange={set("currency")}>
							<option value="TRY">TRY (₺)</option>
							<option value="USD">USD ($)</option>
							<option value="EUR">EUR (€)</option>
						</Select>
					</FormField>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Aylık Kira (Monthly rent)" id="monthlyRent" error={errors.monthlyRent}>
						<Input required type="number" inputMode="decimal" min="0" step="0.01" value={state.monthlyRent} onChange={set("monthlyRent")} />
					</FormField>
					<FormField label="Depozito (Deposit)">
						<Input type="number" inputMode="decimal" min="0" step="0.01" value={state.deposit} onChange={set("deposit")} />
					</FormField>
				</div>
				{overCap && (
					<div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-800">
						<span className="font-bold">Uyarı:</span> Depozito üç aylık kira bedelini aşıyor.
						TBK m.342 uyarınca güvence bedeli üç aylık kirayı geçemez. Devam edebilirsiniz, ancak değeri gözden geçirin.
					</div>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<FormField label="Ödeme Günü (Payment day, 1–28)">
						<Input type="number" inputMode="numeric" min="1" max="28" step="1" value={state.paymentDay} onChange={set("paymentDay")} />
					</FormField>
					<FormField label="Ödeme Şekli (Payment method)">
						<Input value={state.paymentMethod} onChange={set("paymentMethod")} />
					</FormField>
					<FormField label="IBAN / Hesap (Bank account)">
						<Input value={state.bankAccount} onChange={set("bankAccount")} />
					</FormField>
				</div>
			</section>

			{/* F — Utilities */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Abonelikler (Utilities)
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<UtilitySelect label="Elektrik (Electricity)" value={state.utilElectricity} onChange={(v) => onChange("utilElectricity", v)} />
					<UtilitySelect label="Su (Water)" value={state.utilWater} onChange={(v) => onChange("utilWater", v)} />
					<UtilitySelect label="Doğalgaz (Gas)" value={state.utilGas} onChange={(v) => onChange("utilGas", v)} />
					<UtilitySelect label="İnternet (Internet)" value={state.utilInternet} onChange={(v) => onChange("utilInternet", v)} />
					<UtilitySelect label="Aidat (Maintenance)" value={state.utilAidat} onChange={(v) => onChange("utilAidat", v)} />
				</div>
			</section>

			{/* G — Inventory */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
						Demirbaş Listesi (Inventory)
					</h3>
					<Button type="button" variant="ghost" onClick={addInventoryRow}>+ Satır ekle</Button>
				</div>
				{state.inventory.length === 0 ? (
					<p className="text-xs text-slate-400">Demirbaş eklemek için “Satır ekle”ye basın (mobilya, beyaz eşya, anahtar, sayaç vb.).</p>
				) : (
					<div className="space-y-2">
						{state.inventory.map((row, idx) => (
							<div key={idx} className="grid grid-cols-12 gap-2 items-end">
								<div className="col-span-6">
									<FormField label={idx === 0 ? "Demirbaş (Item)" : ""}>
										<Input value={row.item} onChange={(e) => updateInventoryRow(idx, { item: e.target.value })} />
									</FormField>
								</div>
								<div className="col-span-2">
									<FormField label={idx === 0 ? "Adet" : ""}>
										<Input
											type="number"
											inputMode="numeric"
											min="0"
											step="1"
											value={row.qty ?? ""}
											onChange={(e) => updateInventoryRow(idx, { qty: e.target.value === "" ? null : Number(e.target.value) })}
										/>
									</FormField>
								</div>
								<div className="col-span-3">
									<FormField label={idx === 0 ? "Not" : ""}>
										<Input value={row.note ?? ""} onChange={(e) => updateInventoryRow(idx, { note: e.target.value || null })} />
									</FormField>
								</div>
								<div className="col-span-1">
									<Button type="button" variant="ghost" onClick={() => removeInventoryRow(idx)} aria-label="Sil">✕</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Misc clauses */}
			<section className="space-y-4">
				<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
					Diğer Şartlar (Other terms)
				</h3>
				<FormField label="Alt Kiraya Verme (Subletting)">
					<Select
						value={state.sublettingAllowed ? "yes" : "no"}
						onChange={(e) => onChange("sublettingAllowed", e.target.value === "yes")}
					>
						<option value="no">İzin verilmez (Not allowed)</option>
						<option value="yes">Yazılı onayla izinli (Allowed with written consent)</option>
					</Select>
				</FormField>
				<FormField label="Kira Artışı Notu — opsiyonel (Rent-increase override)">
					<Textarea
						rows={2}
						value={state.rentIncreaseNote}
						onChange={set("rentIncreaseNote")}
						placeholder="Boş bırakılırsa TBK m.344 (TÜFE) standart maddesi kullanılır."
					/>
				</FormField>
				<FormField label="Taşınmazın Durumu — opsiyonel (Condition / existing defects)">
					<Textarea rows={3} value={state.conditionNotes} onChange={set("conditionNotes")} />
				</FormField>
				<FormField label="Özel Şartlar — opsiyonel (Special conditions)">
					<Textarea rows={4} value={state.specialConditions} onChange={set("specialConditions")} />
				</FormField>
			</section>
		</div>
	);
}
