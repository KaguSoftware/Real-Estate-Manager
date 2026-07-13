"use client";

import { humanizeError } from "@/src/lib/errors";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getProperty, updateProperty } from "@/src/lib/db/properties";
import { endLease, listLeasesForProperty } from "@/src/lib/db/leases";
import { listPaymentsForLease, recordPayment } from "@/src/lib/db/payments";
import { getDocumentUrl } from "@/src/lib/db/documents";
import { getContractDocumentByRecord, type ContractDocument } from "@/src/lib/db/contractDocuments";
import { cancelSale, closeSale, getActiveSaleForProperty, listSalesForProperty } from "@/src/lib/db/sales";
import { listPropertyImages } from "@/src/lib/db/propertyImages";
import { invalidateCache } from "@/src/lib/useCachedResource";
import { exportToPDF, downloadUrl, getPdfBrandingFromStore, type ListingPDFData } from "@/src/lib/pdf";
import { buildReceiptPDFData, receiptFilename } from "@/src/lib/pdf/receiptData";
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
import { RenewLeaseSheet } from "./RenewLeaseSheet";
import { MatchingLeads } from "./MatchingLeads";
import { LocationPicker } from "./LocationPicker";
import { Pencil, Plus, RefreshCw, Share2, ChevronDown, CheckCircle2, XCircle, History, ExternalLink, Lock, PenLine } from "lucide-react";

/** Current calendar month as ISO period bounds (first → last day). */
function currentMonthPeriod(): { start: string; end: string } {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();
	const pad = (n: number) => String(n).padStart(2, "0");
	const lastDay = new Date(y, m + 1, 0).getDate();
	return {
		start: `${y}-${pad(m + 1)}-01`,
		end: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
	};
}

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


// Display labels for DB enum values (values themselves stay in English).
const STATUS_LABEL: Record<PropertyWithActiveLease["status"], string> = {
	vacant: "Boş",
	occupied: "Kirada",
	sold: "Satıldı",
};
const SALE_STATUS_LABEL: Record<string, string> = {
	active: "Etkin",
	closed: "Tamamlandı",
	cancelled: "İptal edildi",
};
const LEASE_STATUS_LABEL: Record<string, string> = {
	active: "Etkin",
	ended: "Sona erdi",
	cancelled: "İptal edildi",
};

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
	const [renewingLease, setRenewingLease] = useState(false);
	// Which confirmation is open, and whether its action is running.
	const [pendingAction, setPendingAction] = useState<null | "end-lease" | "close-sale" | "cancel-sale" | "record-rent">(null);
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

	useEffect(() => {
		let cancelled = false;
		// Kick off the reload without a synchronous setState in the effect body.
		queueMicrotask(() => { if (!cancelled) reload(); });
		return () => { cancelled = true; };
	}, [reload]);

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

			const safeName = data.address_line.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "ilan";
			await exportToPDF("listing", listing, safeName, await getPdfBrandingFromStore());
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setSharing(false);
		}
	}

	async function handleReceipt(payment: Payment) {
		if (!data?.active_lease) return;
		try {
			const receipt = buildReceiptPDFData(data, data.active_lease, data.active_lease.tenant, payment);
			await exportToPDF("receipt", receipt, receiptFilename(payment), await getPdfBrandingFromStore());
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
				toast.success("Kira sözleşmesi sonlandırıldı — taşınmaz yeniden boş.");
			} else if (pendingAction === "close-sale" && sale) {
				await closeSale(sale.id);
				toast.success("Satış tamamlandı.");
				invalidateCache("stats");
			invalidateCache("attention");
			} else if (pendingAction === "record-rent" && data.active_lease) {
				// One-click convenience: record this calendar month's rent as paid
				// in full. Guard against double-recording the same period.
				const period = currentMonthPeriod();
				const existing = await listPaymentsForLease(data.active_lease.id);
				if (existing.some((p) => p.period_start === period.start)) {
					toast.error("Bu ayın kirası zaten kaydedilmiş.");
				} else {
					await recordPayment({
						lease_id: data.active_lease.id,
						period_start: period.start,
						period_end: period.end,
						amount_due: Number(data.active_lease.monthly_rent),
					});
					invalidateCache("stats");
					invalidateCache("attention");
					toast.success("Bu ayın kirası ödendi olarak kaydedildi.");
				}
			} else if (pendingAction === "cancel-sale" && sale) {
				await cancelSale(sale.id);
				const updated = await updateProperty(data.id, { status: "vacant" });
				upsertProperty(updated);
				toast.success("Satış iptal edildi — taşınmaz yeniden boş.");
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
			<AppShell title="Taşınmaz">
				<div className="py-16 flex justify-center">
					<Spinner />
				</div>
			</AppShell>
		);
	}

	if (error && !data) {
		return (
			<AppShell title="Taşınmaz">
				<Alert>{error}</Alert>
				<Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/properties")}>← Portföye dön</Button>
			</AppShell>
		);
	}

	if (!data) return null;

	const saleTone: BadgeTone =
		sale?.status === "active" ? "amber" : sale?.status === "closed" ? "emerald" : "slate";

	return (
		<AppShell title="Taşınmaz" subtitle={data.city ?? undefined}>
			{/* Address header */}
			<div className="mb-5">
				<h1 className="font-display text-xl sm:text-2xl font-semibold text-base-content leading-tight wrap-break-word">
					{data.address_line}
				</h1>
				{data.city && <p className="text-sm text-base-content/60 mt-1">{data.city}</p>}
			</div>

			{/* Gallery */}
			<PropertyGallery propertyId={propertyId} />

			{data.latitude == null && !editing && (
				<Alert
					tone="warning"
					className="mb-4"
					action={
						<Button size="sm" variant="outline" onClick={() => setEditing(true)}>
							Konum belirle
						</Button>
					}
				>
					Bu taşınmaz henüz haritada değil. Genel bakış haritasında göstermek için konumunu belirleyin.
				</Alert>
			)}

			{error && <Alert className="mb-4">{error}</Alert>}

			{/* Two-column on md+, stacked below */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
				{/* Property info */}
				<Card>
					<div className="flex items-center justify-between gap-2 mb-4">
						<CardLabel>Taşınmaz</CardLabel>
						{!editing && (
							<div className="flex items-center gap-2">
								<Button size="sm" onClick={handleShare} loading={sharing}
									title="Fotoğraflı ve detaylı, müşteriye hazır bir PDF oluşturur">
									{!sharing && <Share2 className="w-4 h-4" />}
									{sharing ? "Hazırlanıyor…" : "Paylaş"}
								</Button>
								<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
									<Pencil className="w-4 h-4" />
									Düzenle
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
							<Field label="Mülk sahibi" value={data.homeowner_name} />
							<Field label="Şehir" value={data.city ?? "—"} />
							<Field label="Büyüklük" value={data.size_sqm != null ? `${data.size_sqm} m²` : "—"} />
							<Field label="Yatak odası / Banyo" value={`${data.bedrooms ?? "—"} / ${data.bathrooms ?? "—"}`} />
							<Field label="İlan" value={data.listing_type === "for_rent" ? "Kiralık" : "Satılık"} />
							<Field label="Durum" value={STATUS_LABEL[data.status]} />
							<Field label="Liste fiyatı" value={data.list_price != null ? fmtMoney(data.list_price, data.currency) : "—"} wide />
							{data.notes && <Field label="Notlar" value={data.notes} wide multiline />}
						</dl>
					)}
				</Card>

				{/* Active lease / sale */}
				<Card>
					<CardLabel className="mb-4 block">
						{data.listing_type === "for_sale"
							? (sale ? "Satış" : "Satış sözleşmesi")
							: (data.active_lease ? "Etkin kira sözleşmesi" : "Kira sözleşmesi")}
					</CardLabel>

					{data.listing_type === "for_sale" ? (
						sale ? (
							<div className="space-y-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-base font-bold text-base-content">{sale.buyer.full_name}</p>
										{(sale.buyer.phone || sale.buyer.email) && (
											<p className="text-sm text-base-content/60 mt-0.5">
												{sale.buyer.phone ?? ""}
												{sale.buyer.phone && sale.buyer.email ? " · " : ""}
												{sale.buyer.email ?? ""}
											</p>
										)}
									</div>
									<Badge tone={saleTone}>{SALE_STATUS_LABEL[sale.status] ?? sale.status}</Badge>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<Highlight label="Satış fiyatı" value={fmtMoney(Number(sale.sale_price), sale.currency)} />
									{sale.deposit_amount != null && (
										<Highlight label="Kapora" value={fmtMoney(Number(sale.deposit_amount), sale.currency)} />
									)}
								</div>

								<dl className="grid grid-cols-2 gap-4 text-sm pt-1">
									<Field label="Satış tarihi" value={sale.sale_date} />
									<Field label="Hedef kapanış" value={sale.target_close_date ?? "—"} />
								</dl>

								{sale.document_pdf_path && (
									<ContractPdfLink path={sale.document_pdf_path} />
								)}
								<ContractDocLink kind="sales" recordId={sale.id} />


								{sale.status === "active" && (
									<div className="flex flex-col sm:flex-row gap-2 pt-1">
										<Button block onClick={() => setPendingAction("close-sale")}>
											<CheckCircle2 className="w-4 h-4" />
											Satışı tamamla
										</Button>
										<Button variant="danger" block onClick={() => setPendingAction("cancel-sale")}>
											<XCircle className="w-4 h-4" />
											Satışı iptal et
										</Button>
									</div>
								)}
							</div>
						) : data.status === "sold" ? (
							<div className="text-center py-6">
								<p className="text-sm text-base-content/60">Bu taşınmaz satıldı.</p>
							</div>
						) : (
							<div className="text-center py-6">
								<p className="text-sm text-base-content/60 mb-4">Bu taşınmaz için satış sözleşmesi yok.</p>
								<Button onClick={() => router.push("/documents/new")}>
									<Plus className="w-4 h-4" />
									Yeni satış sözleşmesi
								</Button>
							</div>
						)
					) : data.active_lease ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-base font-bold text-base-content">{data.active_lease.tenant.full_name}</p>
									{(data.active_lease.tenant.phone || data.active_lease.tenant.email) && (
										<p className="text-sm text-base-content/60 mt-0.5">
											{data.active_lease.tenant.phone ?? ""}
											{data.active_lease.tenant.phone && data.active_lease.tenant.email ? " · " : ""}
											{data.active_lease.tenant.email ?? ""}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Badge tone="emerald">
										{data.active_lease.term === "undefined" ? "Süresiz" : data.active_lease.term === "1yr" ? "1 yıl" : "2 yıl"}
									</Badge>
									<Button size="sm" variant="ghost" onClick={() => setEditingLease(true)}>
										<Pencil className="w-4 h-4" />
										Düzenle
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Highlight label="Aylık kira" value={fmtMoney(Number(data.active_lease.monthly_rent), data.active_lease.currency)} />
								<Highlight label="Depozito" value={fmtMoney(Number(data.active_lease.deposit), data.active_lease.currency)} />
							</div>

							<dl className="grid grid-cols-2 gap-4 text-sm pt-1">
								<Field label="Başlangıç" value={data.active_lease.start_date} />
								<Field label="Bitiş" value={data.active_lease.end_date ?? "—"} />
							</dl>

							{data.active_lease.document_pdf_path && (
								<ContractPdfLink path={data.active_lease.document_pdf_path} />
							)}
							<ContractDocLink kind="rental" recordId={data.active_lease.id} />

							{/* Balance — 3 columns on sm+, stacked on phones */}
							<div className="border-t border-base-300 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
								<BalanceCell label="Ödenen" value={fmtMoney(data.active_lease.balance.totalPaid, data.active_lease.currency)} />
								<BalanceCell label="Vadesi gelen" value={fmtMoney(data.active_lease.balance.totalDue, data.active_lease.currency)} />
								<BalanceCell
									label="Bakiye"
									value={fmtMoney(data.active_lease.balance.balance, data.active_lease.currency)}
									danger={data.active_lease.balance.balance > 0}
								/>
							</div>

							<Button block variant="outline" onClick={() => setPendingAction("record-rent")}>
								<Plus className="w-4 h-4" />
								Bu ayın kirasını kaydet
							</Button>
							<div className="flex flex-col sm:flex-row gap-2">
								<Button block onClick={() => setRenewingLease(true)}>
									<RefreshCw className="w-4 h-4" />
									Sözleşmeyi yenile
								</Button>
								<Button variant="danger" block onClick={() => setPendingAction("end-lease")}>
									Sözleşmeyi sonlandır
								</Button>
							</div>
						</div>
					) : (
						<div className="text-center py-6">
							<p className="text-sm text-base-content/60 mb-4">Bu taşınmaz için etkin kira sözleşmesi yok.</p>
							<Button onClick={() => router.push("/documents/new")}>
								<Plus className="w-4 h-4" />
								Yeni kira sözleşmesi
							</Button>
						</div>
					)}
				</Card>
			</div>

			{/* Location — read-only mini-map */}
			{data.latitude != null && data.longitude != null && (
				<Card className="mt-4 sm:mt-5">
					<div className="flex items-center justify-between gap-2 mb-4">
						<CardLabel>Konum</CardLabel>
						<a
							href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
						>
							Google Haritalar&apos;da aç
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

			{/* Clients whose preferences match this property */}
			<MatchingLeads property={data} />

			{/* Payments — full width */}
			{data.active_lease && (
				<Card className="mt-4 sm:mt-5">
					<CardLabel className="mb-4 block">Ödemeler</CardLabel>
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
					title="Sözleşme geçmişi"
					fetch={async () =>
						(await listLeasesForProperty(data.id)).filter((l) => l.status !== "active")
					}
					render={(l) => (
						<HistoryRow
							key={l.id}
							primary={l.tenant?.full_name ?? "Bilinmeyen kiracı"}
							secondary={`${l.start_date} → ${l.end_date ?? "süresiz"}`}
							amount={fmtMoney(Number(l.monthly_rent), l.currency) + " / ay"}
							badge={<Badge tone={l.status === "ended" ? "slate" : "red"}>{LEASE_STATUS_LABEL[l.status] ?? l.status}</Badge>}
						/>
					)}
				/>
			) : (
				<HistorySection<Sale & { buyer: Tenant | null }>
					title="Satış geçmişi"
					fetch={async () =>
						(await listSalesForProperty(data.id)).filter((s) => s.status !== "active")
					}
					render={(s) => (
						<HistoryRow
							key={s.id}
							primary={s.buyer?.full_name ?? "Bilinmeyen alıcı"}
							secondary={s.sale_date}
							amount={fmtMoney(Number(s.sale_price), s.currency)}
							badge={
								<Badge tone={s.status === "closed" ? "emerald" : "slate"}>{SALE_STATUS_LABEL[s.status] ?? s.status}</Badge>
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

			{/* Renew sheet — mounted only while open so it always starts from fresh values. */}
			{data.active_lease && renewingLease && (
				<RenewLeaseSheet
					open
					lease={data.active_lease}
					onClose={() => setRenewingLease(false)}
					onRenewed={reload}
				/>
			)}

			<ConfirmDialog
				open={pendingAction === "end-lease"}
				title="Bu sözleşme sonlandırılsın mı?"
				message={
					data.active_lease
						? `${data.active_lease.tenant.full_name} ile olan kira sözleşmesi bugün sona erer ve taşınmaz boşa çıkar. Ödeme geçmişi korunur.`
						: undefined
				}
				confirmLabel="Sözleşmeyi sonlandır"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
			<ConfirmDialog
				open={pendingAction === "record-rent"}
				title="Bu ayın kirası kaydedilsin mi?"
				message={
					data.active_lease
						? `${currentMonthPeriod().start.slice(0, 7)} dönemi için ${fmtMoney(Number(data.active_lease.monthly_rent), data.active_lease.currency)} tamamı ödendi olarak kaydedilir. Daha sonra Ödemeler bölümünden düzenleyebilirsiniz.`
						: undefined
				}
				confirmLabel="Kirayı kaydet"
				tone="primary"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
			<ConfirmDialog
				open={pendingAction === "close-sale"}
				title="Bu satış tamamlansın mı?"
				message="Satışı tamamlandı olarak işaretler. Taşınmaz satıldı durumunda kalır."
				confirmLabel="Satışı tamamla"
				tone="primary"
				loading={actionBusy}
				onConfirm={runPendingAction}
				onCancel={() => setPendingAction(null)}
			/>
			<ConfirmDialog
				open={pendingAction === "cancel-sale"}
				title="Bu satış iptal edilsin mi?"
				message="Sözleşme geçersiz olur ve taşınmaz Boş durumuna döner. Bu işlem geri alınamaz."
				confirmLabel="Satışı iptal et"
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
					<History className="w-4 h-4 text-base-content/50" />
					<CardLabel>{title}</CardLabel>
					{items !== null && (
						<span className="text-xs font-semibold text-base-content/50">({items.length})</span>
					)}
				</span>
				<ChevronDown className={`w-4 h-4 text-base-content/50 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="mt-4">
					{loading && (
						<div className="py-6 flex justify-center"><Spinner /></div>
					)}
					{error && <Alert>{error}</Alert>}
					{items !== null && items.length === 0 && (
						<p className="text-sm text-base-content/60 text-center py-4">Bu taşınmaz için geçmiş kayıt yok.</p>
					)}
					{items !== null && items.length > 0 && (
						<ul className="divide-y divide-base-300">{items.map(render)}</ul>
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
				<p className="text-sm font-semibold text-base-content truncate">{primary}</p>
				<p className="text-xs text-base-content/60 mt-0.5">{secondary}</p>
			</div>
			<div className="flex items-center gap-3">
				<span className="text-sm font-semibold text-base-content/80">{amount}</span>
				{badge}
			</div>
		</li>
	);
}

/** "Contract PDF" link for a stored document (private bucket → signed URL). */
function ContractPdfLink({ path }: { path: string }) {
	const [busy, setBusy] = useState(false);
	async function openPdf() {
		setBusy(true);
		try {
			const url = await getDocumentUrl(path);
			const name = path.split("/").pop() || "sozlesme.pdf";
			await downloadUrl(url, name);
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}
	return (
		<button
			type="button"
			onClick={openPdf}
			disabled={busy}
			className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2 disabled:opacity-50"
		>
			<ExternalLink className="w-3.5 h-3.5" />
			{busy ? "İndiriliyor…" : "Sözleşme PDF"}
		</button>
	);
}

/** Link to the editable contract document (migration 0017) for a lease/sale.
 *  Renders nothing for records created before the editor existed. */
function ContractDocLink({ kind, recordId }: { kind: "rental" | "sales"; recordId: string }) {
	const router = useRouter();
	const [doc, setDoc] = useState<ContractDocument | null>(null);
	useEffect(() => {
		let cancelled = false;
		getContractDocumentByRecord(kind, recordId)
			.then((d) => { if (!cancelled) setDoc(d); })
			.catch(() => { /* older record or fetch hiccup — just hide the link */ });
		return () => { cancelled = true; };
	}, [kind, recordId]);
	if (!doc) return null;
	if (doc.status === "finalized") {
		return (
			<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-base-content/50">
				<Lock className="w-3.5 h-3.5" />
				Sözleşme sonlandırıldı
			</span>
		);
	}
	return (
		<button
			type="button"
			onClick={() => router.push(`/documents/${doc.id}`)}
			className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
		>
			<PenLine className="w-3.5 h-3.5" />
			Sözleşmeyi düzenle
		</button>
	);
}

function Field({ label, value, wide, multiline }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
	return (
		<div className={wide ? "sm:col-span-2" : ""}>
			<dt className="text-xs font-semibold text-base-content/55 mb-0.5">{label}</dt>
			<dd className={`text-base-content ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
		</div>
	);
}

function Highlight({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-primary/5 rounded-xl px-4 py-3">
			<p className="text-xs font-semibold text-base-content/55 mb-1">{label}</p>
			<p className="text-base font-bold text-base-content">{value}</p>
		</div>
	);
}

function BalanceCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
	return (
		<div className="bg-base-200 rounded-xl px-4 py-3">
			<p className="text-xs font-semibold text-base-content/55">{label}</p>
			<p className={`font-semibold mt-0.5 ${danger ? "text-error" : "text-base-content"}`}>{value}</p>
		</div>
	);
}
