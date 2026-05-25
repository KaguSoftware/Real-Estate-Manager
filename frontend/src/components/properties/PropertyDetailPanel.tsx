"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import { getProperty, updateProperty } from "@/src/lib/db/properties";
import { endLease } from "@/src/lib/db/leases";
import type { PropertyWithActiveLease } from "@/src/lib/db/types";
import { PaymentList } from "@/src/components/payments/PaymentList";
import { PropertyForm } from "./PropertyForm";

function fmtMoney(n: number, ccy: string) { return `${n.toFixed(2)} ${ccy}`; }

export function PropertyDetailPanel() {
	const selectedId  = useAppStore((s) => s.selectedPropertyId);
	const selectProperty = useAppStore((s) => s.selectProperty);
	const upsertProperty = useAppStore((s) => s.upsertProperty);

	const [data, setData] = useState<PropertyWithActiveLease | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [endingLease, setEndingLease] = useState(false);

	const reload = useCallback(async () => {
		if (!selectedId) return;
		setLoading(true);
		setError(null);
		try { setData(await getProperty(selectedId)); }
		catch (e) { setError(e instanceof Error ? e.message : String(e)); }
		finally { setLoading(false); }
	}, [selectedId]);

	useEffect(() => {
		if (!selectedId) { setData(null); setEditing(false); return; }
		reload();
	}, [selectedId, reload]);

	// Esc to close
	useEffect(() => {
		if (!selectedId) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") selectProperty(null);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedId, selectProperty]);

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

	const open = !!selectedId;

	return (
		<>
			{/* Backdrop */}
			<div
				onClick={() => selectProperty(null)}
				className={`fixed inset-0 z-30 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
			/>

			{/* Panel */}
			<aside
				className={`fixed top-0 right-0 z-40 h-screen w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
				aria-hidden={!open}
			>
				{open && (
					<>
						{/* Header */}
						<div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
							<h2 className="text-sm font-bold text-slate-900 truncate">
								{data?.address_line ?? "Property"}
							</h2>
							<button
								onClick={() => selectProperty(null)}
								className="text-slate-400 hover:text-slate-700 text-xl leading-none"
								aria-label="Close"
							>×</button>
						</div>

						{/* Body */}
						<div className="flex-1 overflow-y-auto px-6 py-5">
							{loading && (
								<div className="flex justify-center py-8">
									<span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
								</div>
							)}

							{error && (
								<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
							)}

							{data && !loading && editing && (
								<PropertyForm
									mode="edit"
									initial={data}
									onCancel={() => setEditing(false)}
									onDone={() => { setEditing(false); reload(); }}
								/>
							)}

							{data && !loading && !editing && (
								<div className="space-y-6">
									{/* Property meta */}
									<section>
										<div className="grid grid-cols-2 gap-4 text-xs">
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Homeowner</p>
												<p className="text-slate-700 font-medium">{data.homeowner_name}</p>
											</div>
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">City</p>
												<p className="text-slate-700">{data.city ?? "—"}</p>
											</div>
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Size</p>
												<p className="text-slate-700">{data.size_sqm ? `${data.size_sqm} m²` : "—"}</p>
											</div>
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bedrooms / Baths</p>
												<p className="text-slate-700">{data.bedrooms ?? "—"} / {data.bathrooms ?? "—"}</p>
											</div>
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</p>
												<p className="text-slate-700 capitalize">{data.listing_type.replace("_", " ")}</p>
											</div>
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
												<p className="text-slate-700 capitalize">{data.status}</p>
											</div>
											<div className="col-span-2">
												<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Listed price</p>
												<p className="text-slate-700">{data.list_price != null ? fmtMoney(data.list_price, data.currency) : "—"}</p>
											</div>
											{data.notes && (
												<div className="col-span-2">
													<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</p>
													<p className="text-slate-700 whitespace-pre-wrap">{data.notes}</p>
												</div>
											)}
										</div>

										<button
											onClick={() => setEditing(true)}
											className="mt-4 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
										>
											Edit property
										</button>
									</section>

									{/* Active lease */}
									{data.active_lease ? (
										<section>
											<h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Active lease</h3>
											<div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-xs">
												<div className="flex justify-between">
													<span className="text-emerald-700 font-semibold">{data.active_lease.tenant.full_name}</span>
													<span className="text-[10px] text-emerald-600 uppercase tracking-wider font-bold">
														{data.active_lease.term === "undefined" ? "Open" : data.active_lease.term}
													</span>
												</div>
												{(data.active_lease.tenant.phone || data.active_lease.tenant.email) && (
													<p className="text-slate-600">
														{data.active_lease.tenant.phone ?? ""}
														{data.active_lease.tenant.phone && data.active_lease.tenant.email ? " · " : ""}
														{data.active_lease.tenant.email ?? ""}
													</p>
												)}
												<div className="grid grid-cols-2 gap-2 pt-1">
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Start</p>
														<p className="text-slate-700">{data.active_lease.start_date}</p>
													</div>
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">End</p>
														<p className="text-slate-700">{data.active_lease.end_date ?? "—"}</p>
													</div>
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Rent</p>
														<p className="text-slate-700">{fmtMoney(Number(data.active_lease.monthly_rent), data.active_lease.currency)}</p>
													</div>
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Deposit</p>
														<p className="text-slate-700">{fmtMoney(Number(data.active_lease.deposit), data.active_lease.currency)}</p>
													</div>
												</div>

												<div className="border-t border-emerald-200 pt-2 mt-2 grid grid-cols-3 gap-2">
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Paid</p>
														<p className="text-slate-800 font-semibold">{fmtMoney(data.active_lease.balance.totalPaid, data.active_lease.currency)}</p>
													</div>
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Due</p>
														<p className="text-slate-800 font-semibold">{fmtMoney(data.active_lease.balance.totalDue, data.active_lease.currency)}</p>
													</div>
													<div>
														<p className="text-[10px] text-emerald-600 uppercase tracking-wider">Balance</p>
														<p className={`font-semibold ${data.active_lease.balance.balance > 0 ? "text-red-600" : "text-slate-800"}`}>
															{fmtMoney(data.active_lease.balance.balance, data.active_lease.currency)}
														</p>
													</div>
												</div>

												<button
													onClick={handleEndLease}
													disabled={endingLease}
													className="w-full mt-2 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
												>
													{endingLease ? "Ending…" : "End lease"}
												</button>
											</div>

											<div className="mt-4">
												<PaymentList
													leaseId={data.active_lease.id}
													currency={data.active_lease.currency}
													monthlyRent={Number(data.active_lease.monthly_rent)}
													onChanged={reload}
												/>
											</div>
										</section>
									) : (
										<section>
											<h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Lease</h3>
											<div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 italic">
												No active lease. Use <span className="font-semibold">New document</span> from the top bar to generate a rental agreement for this property.
											</div>
										</section>
									)}
								</div>
							)}
						</div>
					</>
				)}
			</aside>
		</>
	);
}
