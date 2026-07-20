"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useIsWritable } from "@/src/store";
import type { Property } from "@/src/lib/db/types";
import { Badge, Button, Card, SpinnerBlock, EmptyState, Pagination, usePagination, BulkActionBar, ConfirmDialog, toast, type BadgeTone } from "@/src/components/ui";
import { useMultiSelect } from "@/src/hooks/useMultiSelect";
import { downloadCsv } from "@/src/lib/csv";
import { deleteProperty } from "@/src/lib/db/properties";
import { listCoverImages } from "@/src/lib/db/propertyImages";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { exportToPDF, getPdfBrandingFromStore } from "@/src/lib/pdf";
import { toDataUrl } from "@/src/lib/pdf/imageData";
import { humanizeError } from "@/src/lib/errors";
import { Home, Download, Trash2, Share2 } from "lucide-react";

/** Ceiling on a single brochure. Each page inlines a base64 cover photo, so an
 *  unbounded selection would build a file too heavy to render on a phone. */
const BROCHURE_MAX = 15;

/** Cover photo or a neutral placeholder, sized for list rows/cards. */
function Thumb({ src, className }: { src: string | undefined; className?: string }) {
	if (!src) {
		return (
			<div className={`bg-base-200 flex items-center justify-center text-base-content/30 ${className ?? ""}`}>
				<Home className="w-5 h-5" />
			</div>
		);
	}
	// eslint-disable-next-line @next/next/no-img-element -- Supabase storage URLs; next/image needs remote-domain config
	return <img src={src} alt="" loading="lazy" className={`object-cover ${className ?? ""}`} />;
}

type SortKey = "homeowner_name" | "address_line" | "size_sqm" | "list_price" | "updated_at";
type SortDir = "asc" | "desc";

function fmtPrice(p: number | null, ccy: string) {
	if (p == null) return "—";
	return `${Math.round(p).toLocaleString("tr-TR")} ${ccy}`;
}

// Display labels for DB status values (values themselves stay in English).
const STATUS_LABEL: Record<Property["status"], string> = {
	vacant: "Boş",
	occupied: "Kirada",
	sold: "Satıldı",
};

function StatusBadge({ status }: { status: Property["status"] }) {
	const tone: BadgeTone =
		status === "vacant" ? "slate" : status === "occupied" ? "emerald" : "blue";
	return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

function TypeBadge({ t }: { t: Property["listing_type"] }) {
	return (
		<Badge tone={t === "for_rent" ? "indigo" : "amber"}>
			{t === "for_rent" ? "Kiralık" : "Satılık"}
		</Badge>
	);
}

export function PropertyTable() {
	const router = useRouter();
	const properties = useAppStore((s) => s.properties);
	const isLoading  = useAppStore((s) => s.isLoadingProperties);
	const filters    = useAppStore((s) => s.filters);
	const resetFilters = useAppStore((s) => s.resetFilters);
	const removeProperty = useAppStore((s) => s.removeProperty);
	const isWritable = useIsWritable();

	const { selected, toggle: toggleRow, toggleAll, clear, isSelected, allSelected, count } = useMultiSelect();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [bulkBusy, setBulkBusy] = useState(false);
	const [brochureBusy, setBrochureBusy] = useState(false);

	const hasActiveFilter =
		filters.listing_type !== "all" ||
		filters.status !== "all" ||
		filters.furnished !== "all" ||
		filters.nitelik.length > 0 ||
		filters.location.length > 0 ||
		filters.q !== "";

	// Cover photos for the visible rows — one query per distinct id set, cached
	// under the "properties" prefix so image mutations invalidate it too.
	const idsKey = useMemo(
		() => properties.map((p) => p.id).sort().join(","),
		[properties],
	);
	const { data: covers } = useCachedResource(
		properties.length ? `properties:covers:${idsKey}` : null,
		() => listCoverImages(properties.map((p) => p.id)),
	);

	const [sortKey, setSortKey] = useState<SortKey>("updated_at");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	function toggle(k: SortKey) {
		if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
		else { setSortKey(k); setSortDir("asc"); }
	}

	const sorted = useMemo(() => {
		const arr = [...properties];
		arr.sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			if (typeof av === "number" && typeof bv === "number") return av - bv;
			return String(av).localeCompare(String(bv));
		});
		return sortDir === "asc" ? arr : arr.reverse();
	}, [properties, sortKey, sortDir]);

	// Windows only what the table/cards render; CSV export and the map still
	// use the full sorted/store list.
	const { page, setPage, pageCount, pageItems, total, pageSize } = usePagination(sorted);

	function open(id: string) { router.push(`/properties/${id}`); }
	function prefetch(id: string) { router.prefetch(`/properties/${id}`); }

	const pageIds = pageItems.map((p) => p.id);
	const selectedRows = sorted.filter((p) => selected.has(p.id));

	function exportSelectedCsv() {
		downloadCsv(
			"portfoy-secim",
			["Mülk sahibi", "Adres", "Şehir", "Mahalle", "Nitelik", "İlan", "Durum", "Büyüklük (m²)", "Yatak odası", "Banyo", "Eşyalı", "Fiyat", "Para birimi", "Notlar"],
			selectedRows.map((p) => [
				p.homeowner_name, p.address_line, p.city, p.mahalle, p.nitelik,
				p.listing_type === "for_rent" ? "Kiralık" : "Satılık", STATUS_LABEL[p.status],
				p.size_sqm, p.bedrooms, p.bathrooms,
				p.furnished == null ? "" : p.furnished ? "evet" : "hayır",
				p.list_price, p.currency, p.notes,
			]),
		);
	}

	/**
	 * One client-facing PDF for the whole selection, a page per property.
	 *
	 * Only the cover photo per property is embedded: @react-pdf inlines images
	 * as base64, and gallery photos are stored at up to 1 MB each, so including
	 * all of them would build a file too heavy to render on a phone or send over
	 * WhatsApp. The single-property share on the detail page still includes the
	 * full gallery.
	 */
	async function exportSelectedBrochure() {
		if (selectedRows.length > BROCHURE_MAX) {
			toast.error(`Broşüre en fazla ${BROCHURE_MAX} taşınmaz eklenebilir.`);
			return;
		}
		setBrochureBusy(true);
		try {
			const covers = await listCoverImages(selectedRows.map((p) => p.id));
			const withPhotos = await Promise.all(
				selectedRows.map(async (p) => {
					const url = covers[p.id];
					const dataUrl = url ? await toDataUrl(url) : null;
					// ListingPDFData has no homeowner/tapu fields at all — the client
					// safety of this document is structural, not a filter applied here.
					return {
						address_line: p.address_line,
						city: p.city,
						listing_type: p.listing_type,
						nitelik: p.nitelik,
						bedrooms: p.bedrooms,
						bathrooms: p.bathrooms,
						size_sqm: p.size_sqm,
						list_price: p.list_price,
						currency: p.currency,
						notes: p.notes,
						images: dataUrl ? [dataUrl] : [],
						generatedAt: new Date().toISOString(),
					};
				}),
			);

			await exportToPDF(
				"brochure",
				{ properties: withPhotos, generatedAt: new Date().toISOString() },
				"portfoy-seckisi",
				await getPdfBrandingFromStore(),
			);
			toast.success(`${withPhotos.length} taşınmazlık broşür hazır.`);
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setBrochureBusy(false);
		}
	}

	async function bulkDelete() {
		setBulkBusy(true);
		let ok = 0;
		let failed = 0;
		for (const p of selectedRows) {
			try {
				await deleteProperty(p.id);
				removeProperty(p.id);
				ok++;
			} catch {
				failed++;
			}
		}
		setBulkBusy(false);
		setConfirmDelete(false);
		clear();
		if (failed === 0) toast.success(`${ok} taşınmaz silindi.`);
		else toast.error(`${ok} taşınmaz silindi, ${failed} taşınmaz silinemedi.`);
	}

	if (isLoading) {
		return <SpinnerBlock />;
	}

	if (properties.length === 0) {
		return hasActiveFilter ? (
			<Card>
				<EmptyState
					title="Filtrelerinize uyan taşınmaz yok"
					action={
						<Button variant="outline" size="sm" onClick={resetFilters}>
							Filtreleri temizle
						</Button>
					}
				/>
			</Card>
		) : (
			<Card>
				<EmptyState
					icon={Home}
					title="Henüz taşınmaz yok"
					hint="Haritada ve genel bakışta görmek için ilk ilanınızı ekleyin."
					action={
						<Button size="sm" onClick={() => router.push("/properties/new")}>
							İlk taşınmazınızı ekleyin
						</Button>
					}
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-semibold text-base-content/50 cursor-pointer select-none hover:text-base-content/80";
	const staticHeaderCls = "text-left px-4 py-3 text-xs font-semibold text-base-content/50";
	const sortArrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "";

	return (
		<>
			<div className="px-1 mb-2 flex items-center justify-between">
				<p className="text-xs font-medium text-base-content/50">
					{properties.length} taşınmaz
					{hasActiveFilter ? " eşleşti" : ""}
				</p>
				<button
					type="button"
					onClick={() =>
						downloadCsv(
							"portfoy",
							["Mülk sahibi", "Adres", "Şehir", "Mahalle", "Nitelik", "İlan", "Durum", "Büyüklük (m²)", "Yatak odası", "Banyo", "Eşyalı", "Fiyat", "Para birimi", "Notlar"],
							sorted.map((p) => [
								p.homeowner_name, p.address_line, p.city, p.mahalle, p.nitelik,
								p.listing_type === "for_rent" ? "Kiralık" : "Satılık", STATUS_LABEL[p.status],
								p.size_sqm, p.bedrooms, p.bathrooms,
								p.furnished == null ? "" : p.furnished ? "evet" : "hayır",
								p.list_price, p.currency, p.notes,
							]),
						)
					}
					className="inline-flex items-center gap-1 text-xs font-medium text-base-content/50 hover:text-base-content/80 transition-colors"
				>
					<Download className="w-3.5 h-3.5" />
					CSV indir
				</button>
			</div>

			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{pageItems.map((p) => (
					// div (not button) so the selection checkbox can live inside
					// without invalid interactive nesting.
					<div
						key={p.id}
						role="button"
						tabIndex={0}
						onClick={() => open(p.id)}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(p.id); } }}
						className="w-full text-left bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors cursor-pointer"
					>
						<div className="flex items-start justify-between gap-3">
							<input
								type="checkbox"
								checked={isSelected(p.id)}
								onChange={() => toggleRow(p.id)}
								onClick={(e) => e.stopPropagation()}
								aria-label={`${p.address_line} kaydını seç`}
								className="checkbox checkbox-sm checkbox-primary mt-1 shrink-0"
							/>
							<Thumb src={covers?.[p.id]} className="w-14 h-14 rounded-xl shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-base-content line-clamp-2">{p.address_line}</p>
								<p className="text-sm text-base-content/60 mt-0.5 truncate">{p.homeowner_name}{p.city ? ` · ${p.city}` : ""}</p>
							</div>
							<p className="font-numeric text-sm font-semibold text-base-content/80 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</p>
						</div>
						<div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
							<div className="flex items-center gap-1.5">
								<TypeBadge t={p.listing_type} />
								<StatusBadge status={p.status} />
							</div>
							<p className="text-xs text-base-content/50">{p.size_sqm ? `${p.size_sqm} m²` : ""}</p>
						</div>
					</div>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-160 text-sm">
						<thead className="bg-base-200/60 border-b border-base-300">
							<tr>
								<th className="px-4 py-3 w-10">
									<input
										type="checkbox"
										checked={allSelected(pageIds)}
										onChange={() => toggleAll(pageIds)}
										aria-label="Sayfadaki tüm taşınmazları seç"
										className="checkbox checkbox-sm checkbox-primary align-middle"
									/>
								</th>
								<th className={staticHeaderCls}><span className="sr-only">Fotoğraf</span></th>
								<th className={headerCls} onClick={() => toggle("homeowner_name")}>Mülk sahibi {sortArrow("homeowner_name")}</th>
								<th className={headerCls} onClick={() => toggle("address_line")}>Adres {sortArrow("address_line")}</th>
								<th className={headerCls} onClick={() => toggle("size_sqm")}>Büyüklük (m²) {sortArrow("size_sqm")}</th>
								<th className={staticHeaderCls}>İlan</th>
								<th className={staticHeaderCls}>Durum</th>
								<th className={headerCls} onClick={() => toggle("list_price")}>Fiyat {sortArrow("list_price")}</th>
								<th className={headerCls} onClick={() => toggle("updated_at")}>Güncellendi {sortArrow("updated_at")}</th>
							</tr>
						</thead>
						<tbody>
							{pageItems.map((p) => (
								<tr
									key={p.id}
									onClick={() => open(p.id)}
									onMouseEnter={() => prefetch(p.id)}
									className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors cursor-pointer"
								>
									<td className="px-4 py-2 w-10" onClick={(e) => e.stopPropagation()}>
										<input
											type="checkbox"
											checked={isSelected(p.id)}
											onChange={() => toggleRow(p.id)}
											aria-label={`${p.address_line} kaydını seç`}
											className="checkbox checkbox-sm checkbox-primary align-middle"
										/>
									</td>
									<td className="pl-4 pr-0 py-2">
										<Thumb src={covers?.[p.id]} className="w-11 h-11 rounded-lg" />
									</td>
									<td className="px-4 py-3 text-sm font-medium text-base-content min-w-0">{p.homeowner_name}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 min-w-0">{p.address_line}{p.city ? `, ${p.city}` : ""}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">{p.size_sqm ?? "—"}</td>
									<td className="px-4 py-3"><TypeBadge t={p.listing_type} /></td>
									<td className="px-4 py-3"><StatusBadge status={p.status} /></td>
									<td className="px-4 py-3 font-numeric text-sm text-base-content/80 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</td>
									<td className="px-4 py-3 text-sm text-base-content/50 whitespace-nowrap">
										{new Date(p.updated_at).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
			<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />

			<BulkActionBar count={count} label={`${count} taşınmaz seçildi`} onClear={clear}>
				<Button size="sm" variant="outline" onClick={exportSelectedCsv}>
					<Download className="w-4 h-4" />
					CSV indir
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={exportSelectedBrochure}
					disabled={brochureBusy || count > BROCHURE_MAX}
					title={count > BROCHURE_MAX ? `En fazla ${BROCHURE_MAX} taşınmaz seçebilirsiniz.` : undefined}
				>
					<Share2 className="w-4 h-4" />
					{brochureBusy ? "Hazırlanıyor…" : "Broşür oluştur"}
				</Button>
				{isWritable && (
					<Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
						<Trash2 className="w-4 h-4" />
						Seçilenleri sil
					</Button>
				)}
			</BulkActionBar>

			<ConfirmDialog
				open={confirmDelete}
				title="Seçilen taşınmazlar silinsin mi?"
				message={`${count} taşınmaz kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
				confirmLabel="Seçilenleri sil"
				loading={bulkBusy}
				onConfirm={bulkDelete}
				onCancel={() => setConfirmDelete(false)}
			/>
		</>
	);
}
