"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getProperty, updateProperty } from "@/src/lib/db/properties";
import { endLease } from "@/src/lib/db/leases";
import { getActiveSaleForProperty } from "@/src/lib/db/sales";
import { listPropertyImages } from "@/src/lib/db/propertyImages";
import { exportToPDF, type ListingPDFData } from "@/src/lib/pdf";
import type { PropertyWithActiveLease, Sale, Tenant } from "@/src/lib/db/types";
import { PaymentList } from "@/src/components/payments/PaymentList";
import { AppShell, Button, Card, CardLabel, Badge, type BadgeTone } from "@/src/components/ui";
import { PropertyGallery } from "./PropertyGallery";
import { PropertyForm } from "./PropertyForm";
import { Pencil, TriangleAlert, Plus, Share2 } from "lucide-react";

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
	const [sharing, setSharing] = useState(false);

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
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSharing(false);
		}
	}

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
			<AppShell title="Property">
				<div className="py-16 flex justify-center">
					<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
				</div>
			</AppShell>
		);
	}

	if (error && !data) {
		return (
			<AppShell title="Property">
				<div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
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

			{data.latitude == null && (
				<div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
					<TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
					<span>
						This property isn&apos;t on the map yet — we couldn&apos;t pin its address automatically.
						Tap <strong>Edit</strong> and paste a Google Maps link to add it.
					</span>
				</div>
			)}

			{error && (
				<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
			)}

			{/* Two-column on lg+, stacked below */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
								<Badge tone="emerald">
									{data.active_lease.term === "undefined" ? "Open" : data.active_lease.term}
								</Badge>
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

							<Button variant="danger" block onClick={handleEndLease} loading={endingLease}>
								{endingLease ? "Ending…" : "End lease"}
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

			{/* Payments — full width */}
			{data.active_lease && (
				<Card className="mt-4 sm:mt-5">
					<CardLabel className="mb-4 block">Payments</CardLabel>
					<PaymentList
						leaseId={data.active_lease.id}
						currency={data.active_lease.currency}
						monthlyRent={Number(data.active_lease.monthly_rent)}
						onChanged={reload}
					/>
				</Card>
			)}
		</AppShell>
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
