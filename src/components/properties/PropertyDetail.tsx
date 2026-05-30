"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getProperty, updateProperty } from "@/src/lib/db/properties";
import { endLease } from "@/src/lib/db/leases";
import { getActiveSaleForProperty } from "@/src/lib/db/sales";
import type { PropertyWithActiveLease, Sale, Tenant } from "@/src/lib/db/types";
import { PaymentList } from "@/src/components/payments/PaymentList";
import { PropertyGallery } from "./PropertyGallery";
import { PropertyForm } from "./PropertyForm";
import { ArrowLeft, Pencil, TriangleAlert, Plus } from "lucide-react";

function fmtMoney(n: number, ccy: string) { return `${n.toFixed(2)} ${ccy}`; }

interface Props {
	propertyId: string;
}

export function PropertyDetail({ propertyId }: Props) {
	const router = useRouter();
	const upsertProperty = useAppStore((s) => s.upsertProperty);

	const [data, setData] = useState<PropertyWithActiveLease | null>(null);
	const [sale, setSale] = useState<(Sale & { buyer: Tenant }) | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [endingLease, setEndingLease] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const prop = await getProperty(propertyId);
			setData(prop);
			if (prop.listing_type === "for_sale") {
				setSale(await getActiveSaleForProperty(propertyId));
			} else {
				setSale(null);
			}
		}
		catch (e) { setError(e instanceof Error ? e.message : String(e)); }
		finally { setLoading(false); }
	}, [propertyId]);

	useEffect(() => { reload(); }, [reload]);

	async function handleEndLease() {
		if (!data?.active_lease) return;
		if (!confirm(`End the active lease for ${data.active_lease.tenant.full_name}? Property will become vacant.`)) return;
		setEndingLease(true);
		try {
			await endLease(data.active_lease.id, new Date().toISOString().slice(0, 10));
			const updated = await updateProperty(data.id, { status: "vacant" });
			upsertProperty(updated);
			await reload();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally { setEndingLease(false); }
	}

	if (loading && !data) {
		return (
			<div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex justify-center">
				<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
				<div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
					{error}
				</div>
				<Link href="/" className="mt-4 text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
					<ArrowLeft className="w-3.5 h-3.5" />
					Back to dashboard
				</Link>
			</div>
		);
	}

	if (!data) return null;

	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
			{/* Address header */}
			<div className="mb-5">
				<h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words">
					{data.address_line}
				</h1>
				{data.city && <p className="text-sm text-slate-500 mt-1">{data.city}</p>}
			</div>

			{/* Gallery */}
			<PropertyGallery propertyId={propertyId} />

			{data.latitude == null && (
				<div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
					<TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
					<span>
						This property isn't on the map yet — we couldn't pin its address automatically.
						Click <strong>Edit</strong> and paste a Google Maps link to add it.
					</span>
				</div>
			)}

			{error && (
				<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
			)}

			{/* Two-column on lg+, stacked below */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				{/* Property info */}
				<section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Property</h2>
						{!editing && (
							<button
								onClick={() => setEditing(true)}
								className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
							>
								<Pencil className="w-3 h-3" />
								Edit
							</button>
						)}
					</div>

					{editing ? (
						<PropertyForm
							mode="edit"
							initial={data}
							onCancel={() => setEditing(false)}
							onDone={() => { setEditing(false); reload(); }}
						/>
					) : (
						<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
							<Field label="Homeowner" value={data.homeowner_name} />
							<Field label="City" value={data.city ?? "—"} />
							<Field label="Size" value={data.size_sqm != null ? `${data.size_sqm} m²` : "—"} />
							<Field label="Bedrooms / Baths" value={`${data.bedrooms ?? "—"} / ${data.bathrooms ?? "—"}`} />
							<Field label="Type" value={data.listing_type === "for_rent" ? "For Rent" : "For Sale"} />
							<Field label="Status" value={data.status[0].toUpperCase() + data.status.slice(1)} />
							<Field
								label="Listed price"
								value={data.list_price != null ? fmtMoney(data.list_price, data.currency) : "—"}
								wide
							/>
							{data.notes && (
								<Field label="Notes" value={data.notes} wide multiline />
							)}
						</dl>
					)}
				</section>

				{/* Active lease / sale */}
				<section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
					<h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
						{data.listing_type === "for_sale"
							? (sale ? "Sale" : "Sales agreement")
							: (data.active_lease ? "Active lease" : "Lease")}
					</h2>

					{data.listing_type === "for_sale" ? (
						sale ? (
							<div className="space-y-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-bold text-slate-900">{sale.buyer.full_name}</p>
										{(sale.buyer.phone || sale.buyer.email) && (
											<p className="text-xs text-slate-500 mt-0.5">
												{sale.buyer.phone ?? ""}
												{sale.buyer.phone && sale.buyer.email ? " · " : ""}
												{sale.buyer.email ?? ""}
											</p>
										)}
									</div>
									<span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
										sale.status === "active"
											? "bg-amber-50 text-amber-700 border-amber-200"
											: sale.status === "closed"
												? "bg-emerald-50 text-emerald-700 border-emerald-200"
												: "bg-slate-50 text-slate-600 border-slate-200"
									}`}>
										{sale.status}
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<Highlight label="Sale price" value={fmtMoney(Number(sale.sale_price), sale.currency)} />
									{sale.deposit_amount != null && (
										<Highlight label="Deposit" value={fmtMoney(Number(sale.deposit_amount), sale.currency)} />
									)}
								</div>

								<dl className="grid grid-cols-2 gap-4 text-xs pt-1">
									<Field label="Sale date" value={sale.sale_date} />
									<Field label="Target close" value={sale.target_close_date ?? "—"} />
								</dl>
							</div>
						) : data.status === "sold" ? (
							<div className="text-center py-6">
								<p className="text-xs text-slate-500">This property is sold.</p>
							</div>
						) : (
							<div className="text-center py-6">
								<p className="text-xs text-slate-500 mb-4">No sales agreement for this property.</p>
								<button
									onClick={() => router.push("/documents/new")}
									className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
								>
									<Plus className="w-3.5 h-3.5" />
									New sales agreement
								</button>
							</div>
						)
					) : data.active_lease ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-sm font-bold text-slate-900">{data.active_lease.tenant.full_name}</p>
									{(data.active_lease.tenant.phone || data.active_lease.tenant.email) && (
										<p className="text-xs text-slate-500 mt-0.5">
											{data.active_lease.tenant.phone ?? ""}
											{data.active_lease.tenant.phone && data.active_lease.tenant.email ? " · " : ""}
											{data.active_lease.tenant.email ?? ""}
										</p>
									)}
								</div>
								<span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
									{data.active_lease.term === "undefined" ? "Open" : data.active_lease.term}
								</span>
							</div>

							{/* Rent + Deposit highlight pair */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Highlight
									label="Monthly rent"
									value={fmtMoney(Number(data.active_lease.monthly_rent), data.active_lease.currency)}
								/>
								<Highlight
									label="Security deposit"
									value={fmtMoney(Number(data.active_lease.deposit), data.active_lease.currency)}
								/>
							</div>

							{/* Dates */}
							<dl className="grid grid-cols-2 gap-4 text-xs pt-1">
								<Field label="Start" value={data.active_lease.start_date} />
								<Field label="End" value={data.active_lease.end_date ?? "—"} />
							</dl>

							{/* Balance */}
							<div className="border-t border-slate-100 pt-4 grid grid-cols-3 gap-2 text-xs">
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paid</p>
									<p className="text-slate-800 font-semibold mt-0.5">{fmtMoney(data.active_lease.balance.totalPaid, data.active_lease.currency)}</p>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Due</p>
									<p className="text-slate-800 font-semibold mt-0.5">{fmtMoney(data.active_lease.balance.totalDue, data.active_lease.currency)}</p>
								</div>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balance</p>
									<p className={`font-semibold mt-0.5 ${data.active_lease.balance.balance > 0 ? "text-red-600" : "text-slate-800"}`}>
										{fmtMoney(data.active_lease.balance.balance, data.active_lease.currency)}
									</p>
								</div>
							</div>

							<button
								onClick={handleEndLease}
								disabled={endingLease}
								className="w-full mt-2 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
							>
								{endingLease ? "Ending…" : "End lease"}
							</button>
						</div>
					) : (
						<div className="text-center py-6">
							<p className="text-xs text-slate-500 mb-4">No active lease for this property.</p>
							<button
								onClick={() => router.push("/documents/new")}
								className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
							>
								<Plus className="w-3.5 h-3.5" />
								New rental agreement
							</button>
						</div>
					)}
				</section>
			</div>

			{/* Payments — full width */}
			{data.active_lease && (
				<section className="mt-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
					<h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Payments</h2>
					<PaymentList
						leaseId={data.active_lease.id}
						currency={data.active_lease.currency}
						monthlyRent={Number(data.active_lease.monthly_rent)}
						onChanged={reload}
					/>
				</section>
			)}
		</div>
	);
}

function Field({ label, value, wide, multiline }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
	return (
		<div className={wide ? "sm:col-span-2" : ""}>
			<dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</dt>
			<dd className={`text-slate-800 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
		</div>
	);
}

function Highlight({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-indigo-50 rounded-xl px-4 py-3">
			<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">{label}</p>
			<p className="text-base font-bold text-slate-900">{value}</p>
		</div>
	);
}
