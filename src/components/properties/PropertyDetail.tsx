"use client";

import { humanizeError } from "@/src/lib/errors";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getProperty, updateProperty } from "@/src/lib/db/properties";
import { endLease, listLeasesForProperty } from "@/src/lib/db/leases";
import { cancelSale, closeSale, getActiveSaleForProperty, listSalesForProperty } from "@/src/lib/db/sales";
import { listPropertyImages } from "@/src/lib/db/propertyImages";
import { invalidateCache } from "@/src/lib/useCachedResource";
import { exportToPDF, type ListingPDFData, type ReceiptPDFData } from "@/src/lib/pdf";
import { fmtMoney } from "@/src/lib/format";
import type { Lease, Payment, PropertyWithActiveLease, Sale, Tenant } from "@/src/lib/db/types";
import { PaymentList } from "@/src/components/payments/PaymentList";
import {
	AppShell, Button, Card, CardLabel, Badge, type BadgeTone,
	ConfirmDialog, Alert, Spinner, toast,
} from "@/src/components/ui";
import { PropertyGallery } from "./PropertyGallery";
import { PropertyForm } from "./PropertyForm";
import { LeaseEditSheet } from "./LeaseEditSheet";
import { LocationPicker } from "./LocationPicker";
import { Pencil, Plus, Share2, ChevronDown, CheckCircle2, XCircle, History, ExternalLink } from "lucide-react";

/** Fetch a public image URL and return it as a data URL so @react-pdf embeds
 *  it reliably (avoids intermittent remote-fetch/CORS failures during render). */
async function toDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}


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
	const [sharing, setSharing] = useState(false);
	const [editingLease, setEditingLease] = useState(false);
	// Which confirmation is open, and whether its action is running.
	const [pendingAction, setPendingAction] = useState<null | "end-lease" | "close-sale" | "cancel-sale">(null);
	const [actionBusy, setActionBusy] = useState(false);

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
		catch (e) { setError(humanizeError(e)); }
		finally { setLoading(false); }
	}, [propertyId]);

	useEffect(() => { reload(); }, [reload]);

	async function handleShare() {
		if (!data) return;
		setSharing(true);
		setError(null);
		try {
			const imgs = await listPropertyImages(data.id);
			const dataUrls = (await Promise.all(imgs.map((i) => toDataUrl(i.url))))
				.filter((u): u is string => !!u);

			const listing: ListingPDFData = {
				address_line: data.address_line,
				city: data.city,
				listing_type: data.listing_type,
				nitelik: data.nitelik,
				bedrooms: data.bedrooms,
				bathrooms: data.bathrooms,
				size_sqm: data.size_sqm,
				list_price: data.list_price,
				currency: data.currency,
				notes: data.notes,
				images: dataUrls,
				generatedAt: new Date().toISOString(),
			};

			const safeName = data.address_line.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "listing";
			await exportToPDF("listing", listing, safeName);
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setSharing(false);
		}
	}

	async function handleReceipt(payment: Payment) {
		if (!data?.active_lease) return;
		try {
			const receipt: ReceiptPDFData = {
				landlord_name: data.homeowner_name,
				tenant_name: data.active_lease.tenant.full_name,
				property_address: data.address_line,
				city: data.city,
				period_start: payment.period_start,
				period_end: payment.period_end,
				amount: Number(payment.amount_paid),
				currency: data.active_lease.currency,
				method: payment.method,
				paid_at: payment.paid_at,
				generatedAt: new Date().toISOString(),
			};
			await exportToPDF("receipt", receipt, `receipt-${payment.period_start}`);
		} catch (e) {
			toast.error(humanizeError(e));
		}
	}

	async function runPendingAction() {
		if (!data || !pendingAction) return;
		setActionBusy(true);
		setError(null);
		try {
			if (pendingAction === "end-lease" && data.active_lease) {
				await endLease(data.active_lease.id, new Date().toISOString().slice(0, 10));
				const updated = await updateProperty(data.id, { status: "vacant" });
				upsertProperty(updated);
				toast.success("Lease ended — property is vacant again.");
			} else if (pendingAction === "close-sale" && sale) {
				await closeSale(sale.id);
				toast.success("Sale closed.");
				invalidateCache("stats");
			invalidateCache("attention");
			} else if (pendingAction === "cancel-sale" && sale) {
				await cancelSale(sale.id);
				const updated = await updateProperty(data.id, { status: "vacant" });
				upsertProperty(updated);
				toast.success("Sale cancelled — property is vacant again.");
			}
			setPendingAction(null);
			await reload();
		} catch (e) {
			setPendingAction(null);
			const msg = humanizeError(e);
			setError(msg);
			toast.error(msg);
		} finally {
			setActionBusy(false);
		}
	}

	if (loading && !data) {
		return (
			<AppShell title="Property">
				<div className="py-16 flex justify-center">
					<Spinner />
				</div>
			</AppShell>
		);
	}

	if (error && !data) {
		return (
			<AppShell title="Property">
				<Alert>{error}</Alert>
				<Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/")}>← Back to properties</Button>
			</AppShell>
		);
	}

	if (!data) return null;

	const saleTone: BadgeTone =
		sale?.status === "active" ? "amber" : sale?.status === "closed" ? "emerald" : "slate";

	return (
		<AppShell title="Property" subtitle={data.city ?? undefined}>
			{/* Address header */}
			<div className="mb-5">
				<h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight wrap-break-word">
					{data.address_line}
				</h1>
				{data.city && <p className="text-sm text-slate-500 mt-1">{data.city}</p>}
			</div>

			{/* Gallery */}
			<PropertyGallery propertyId={propertyId} />

			{data.latitude == null && !editing && (
				<Alert
					tone="warning"
					className="mb-4"
					action={
						<Button size="sm" variant="outline" onClick={() => setEditing(true)}>
							Set location
						</Button>
					}
				>
					This property isn&apos;t on the map yet. Set its location to show it on the dashboard map.
				</Alert>
			)}

			{error && <Alert className="mb-4">{error}</Alert>}

			{/* Two-column on md+, stacked below */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
				{/* Property info */}
				<Card>
					<div className="flex items-center justify-between gap-2 mb-4">
						<CardLabel>Property</CardLabel>
						{!editing && (
							<div className="flex items-center gap-2">
								<Button size="sm" onClick={handleShare} loading={sharing}
									title="Generate a client-ready PDF with photos & details">
									{!sharing && <Share2 className="w-4 h-4" />}
									{sharing ? "Preparing…" : "Share"}
								</Button>
								<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
									<Pencil className="w-4 h-4" />
									Edit
								</Button>
							</div>
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
						<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
							<Field label="Homeowner" value={data.homeowner_name} />
							<Field label="City" value={data.city ?? "—"} />
							<Field label="Size" value={data.size_sqm != null ? `${data.size_sqm} m²` : "—"} />
							<Field label="Bedrooms / Baths" value={`${data.bedrooms ?? "—"} / ${data.bathrooms ?? "—"}`} />
							<Field label="Type" value={data.listing_type === "for_rent" ? "For Rent" : "For Sale"} />
							<Field label="Status" value={data.status[0].toUpperCase() + data.status.slice(1)} />
							<Field label="Listed price" value={data.list_price != null ? fmtMoney(data.list_price, data.currency) : "—"} wide />
							{data.notes && <Field label="Notes" value={data.notes} wide multiline />}
						</dl>
					)}
				</Card>

				{/* Active lease / sale */}
				<Card>
					<CardLabel className="mb-4 block">
						{data.listing_type === "for_sale"
							? (sale ? "Sale" : "Sales agreement")
							: (data.active_lease ? "Active lease" : "Lease")}
					</CardLabel>

					{data.listing_type === "for_sale" ? (
						sale ? (
							<div className="space-y-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-base font-bold text-slate-900">{sale.buyer.full_name}</p>
										{(sale.buyer.phone || sale.buyer.email) && (
											<p className="text-sm text-slate-500 mt-0.5">
												{sale.buyer.phone ?? ""}
												{sale.buyer.phone && sale.buyer.email ? " · " : ""}
												{sale.buyer.email ?? ""}
											</p>
										)}
									</div>
									<Badge tone={saleTone}>{sale.status}</Badge>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<Highlight label="Sale price" value={fmtMoney(Number(sale.sale_price), sale.currency)} />
									{sale.deposit_amount != null && (
										<Highlight label="Deposit" value={fmtMoney(Number(sale.deposit_amount), sale.currency)} />
									)}
								</div>

								<dl className="grid grid-cols-2 gap-4 text-sm pt-1">
									<Field label="Sale date" value={sale.sale_date} />
									<Field label="Target close" value={sale.target_close_date ?? "—"} />
								</dl>

								{sale.status === "active" && (
									<div className="flex flex-col sm:flex-row gap-2 pt-1">
										<Button block onClick={() => setPendingAction("close-sale")}>
											<CheckCircle2 className="w-4 h-4" />
											Close sale
										</Button>
										<Button variant="danger" block onClick={() => setPendingAction("cancel-sale")}>
											<XCircle className="w-4 h-4" />
											Cancel sale
										</Button>
									</div>
								)}
							</div>
						) : data.status === "sold" ? (
							<div className="text-center py-6">
								<p className="text-sm text-slate-500">This property is sold.</p>
							</div>
						) : (
							<div className="text-center py-6">
								<p className="text-sm text-slate-500 mb-4">No sales agreement for this property.</p>
								<Button onClick={() => router.push("/documents/new")}>
									<Plus className="w-4 h-4" />
									New sales agreement
								</Button>
							</div>
						)
					) : data.active_lease ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-base font-bold text-slate-900">{data.active_lease.tenant.full_name}</p>
									{(data.active_lease.tenant.phone || data.active_lease.tenant.email) && (
										<p className="text-sm text-slate-500 mt-0.5">
											{data.active_lease.tenant.phone ?? ""}
											{data.active_lease.tenant.phone && data.active_lease.tenant.email ? " · " : ""}
											{data.active_lease.tenant.email ?? ""}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Badge tone="emerald">
										{data.active_lease.term === "undefined" ? "Open" : data.active_lease.term}
									</Badge>
									<Button size="sm" variant="ghost" onClick={() => setEditingLease(true)}>
										<Pencil className="w-4 h-4" />
										Edit
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Highlight label="Monthly rent" value={fmtMoney(Number(data.active_lease.monthly_rent), data.active_lease.currency)} />
								<Highlight label="Security deposit" value={fmtMoney(Number(data.active_lease.deposit), data.active_lease.currency)} />
							</div>

							<dl className="grid grid-cols-2 gap-4 text-sm pt-1">
								<Field label="Start" value={data.active_lease.start_date} />
								<Field label="End" value={data.active_lease.end_date ?? "—"} />
							</dl>

							{/* Balance — 3 columns on sm+, stacked on phones */}
							<div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
								<BalanceCell label="Paid" value={fmtMoney(data.active_lease.balance.totalPaid, data.active_lease.currency)} />
								<BalanceCell label="Due" value={fmtMoney(data.active_lease.balance.totalDue, data.active_lease.currency)} />
								<BalanceCell
									label="Balance"
									value={fmtMoney(data.active_lease.balance.balance, data.active_lease.currency)}
									danger={data.active_lease.balance.balance > 0}
								/>
							</div>

							<Button variant="danger" block onClick={() => setPendingAction("end-lease")}>
								End lease
							</Button>
						</div>
					) : (
						<div className="text-center py-6">
							<p className="text-sm text-slate-500 mb-4">No active lease for this property.</p>
							<Button onClick={() => router.push("/documents/new")}>
								<Plus className="w-4 h-4" />
								New rental agreement
							</Button>
						</div>
					)}
				</Card>
			</div>

			{/* Location — read-only mini-map */}
			{data.latitude != null && data.longitude != null && (
				<Card className="mt-4 sm:mt-5">
					<div className="flex items-center justify-between gap-2 mb-4">
						<CardLabel>Location</CardLabel>
						<a
							href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
						>
							Open in Google Maps
							<ExternalLink className="w-3.5 h-3.5" />
						</a>
					</div>
					<LocationPicker
						value={{ lat: Number(data.latitude), lon: Number(data.longitude) }}
						onChange={() => {}}
						readOnly
						heightClass="h-48 sm:h-56"
					/>
				</Card>
			)}

			{/* Payments — full width */}
			{data.active_lease && (
				<Card className="mt-4 sm:mt-5">
					<CardLabel className="mb-4 block">Payments</CardLabel>
					<PaymentList
						leaseId={data.active_lease.id}
						currency={data.active_lease.currency}
						monthlyRent={Number(data.active_lease.monthly_rent)}
						onChanged={reload}
						onReceipt={handleReceipt}
					/>
				</Card>
			)}

			{/* History — past leases / sales */}
			{data.listing_type === "for_rent" ? (
				<HistorySection<Lease & { tenant: Tenant | null }>
					title="Lease history"
					fetch={async () =>
						(await listLeasesForProperty(data.id)).filter((l) => l.status !== "active")
					}
					render={(l) => (
						<HistoryRow
							key={l.id}
							primary={l.tenant?.full_name ?? "Unknown tenant"}
							secondary={`${l.start_date} → ${l.end_date ?? "open"}`}
							amount={fmtMoney(Number(l.monthly_rent), l.currency) + " / mo"}
							badge={<Badge tone={l.status === "ended" ? "slate" : "red"}>{l.status}</Badge>}
						/>
					)}
				/>
			) : (
				<HistorySection<Sale & { buyer: Tenant | null }>
					title="Sale history"
					fetch={async () =>
						(await listSalesForProperty(data.id)).filter((s) => s.status !== "active")
					}
					render={(s) => (
						<HistoryRow
							key={s.id}
							primary={s.buyer?.full_name ?? "Unknown buyer"}
							secondary={s.sale_date}
							amount={fmtMoney(Number(s.sale_price), s.currency)}
							badge={
								<Badge tone={s.status === "closed" ? "emerald" : "slate"}>{s.status}</Badge>
							}
						/>
					)}
				/>
			)}

			{/* Lease edit sheet — mounted only while open so it always starts from fresh values. */}
			{data.active_lease && editingLease && (
				<LeaseEditSheet
					open
					lease={data.active_lease}
					onClose={() => setEditingLease(false)}
					onSaved={reload}
				/>
			)}

			<ConfirmDialog
				open={pendingAction === "end-lease"}
				title="End this lease?"
				message={
					data.active_lease
						? `The lease for ${data.active_lease.tenant.full_name} will end today and the property becomes vacant. Payment history is kept.`
						: undefined
				}
				confirmLabel="End lease"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
			<ConfirmDialog
				open={pendingAction === "close-sale"}
				title="Close this sale?"
				message="Marks the sale as completed. The property stays sold."
				confirmLabel="Close sale"
				tone="primary"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
			<ConfirmDialog
				open={pendingAction === "cancel-sale"}
				title="Cancel this sale?"
				message="The agreement is voided and the property returns to Vacant. This cannot be undone."
				confirmLabel="Cancel sale"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
		</AppShell>
	);
}

/** Collapsible, lazily-fetched history list. */
function HistorySection<T>({
	title,
	fetch,
	render,
}: {
	title: string;
	fetch: () => Promise<T[]>;
	render: (item: T) => React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<T[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function toggle() {
		const next = !open;
		setOpen(next);
		if (next && items === null && !loading) {
			setLoading(true);
			setError(null);
			try { setItems(await fetch()); }
			catch (e) { setError(humanizeError(e)); }
			finally { setLoading(false); }
		}
	}

	return (
		<Card className="mt-4 sm:mt-5">
			<button
				type="button"
				onClick={toggle}
				aria-expanded={open}
				className="w-full flex items-center justify-between gap-2 text-left"
			>
				<span className="flex items-center gap-2">
					<History className="w-4 h-4 text-slate-400" />
					<CardLabel>{title}</CardLabel>
					{items !== null && (
						<span className="text-xs font-semibold text-slate-400">({items.length})</span>
					)}
				</span>
				<ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="mt-4">
					{loading && (
						<div className="py-6 flex justify-center"><Spinner /></div>
					)}
					{error && <Alert>{error}</Alert>}
					{items !== null && items.length === 0 && (
						<p className="text-sm text-slate-500 text-center py-4">No past records for this property.</p>
					)}
					{items !== null && items.length > 0 && (
						<ul className="divide-y divide-slate-100">{items.map(render)}</ul>
					)}
				</div>
			)}
		</Card>
	);
}

function HistoryRow({
	primary,
	secondary,
	amount,
	badge,
}: {
	primary: string;
	secondary: string;
	amount: string;
	badge: React.ReactNode;
}) {
	return (
		<li className="py-3 flex flex-wrap items-center justify-between gap-2">
			<div className="min-w-0">
				<p className="text-sm font-semibold text-slate-800 truncate">{primary}</p>
				<p className="text-xs text-slate-500 mt-0.5">{secondary}</p>
			</div>
			<div className="flex items-center gap-3">
				<span className="text-sm font-semibold text-slate-700">{amount}</span>
				{badge}
			</div>
		</li>
	);
}

function Field({ label, value, wide, multiline }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
	return (
		<div className={wide ? "sm:col-span-2" : ""}>
			<dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</dt>
			<dd className={`text-slate-800 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
		</div>
	);
}

function Highlight({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-primary/5 rounded-xl px-4 py-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{label}</p>
			<p className="text-base font-bold text-slate-900">{value}</p>
		</div>
	);
}

function BalanceCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
	return (
		<div className="bg-slate-50 rounded-xl px-4 py-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
			<p className={`font-semibold mt-0.5 ${danger ? "text-red-600" : "text-slate-800"}`}>{value}</p>
		</div>
	);
}
