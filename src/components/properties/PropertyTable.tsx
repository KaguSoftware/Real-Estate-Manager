"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import type { Property } from "@/src/lib/db/types";
import { Badge, Button, Card, SpinnerBlock, EmptyState, Pagination, usePagination, type BadgeTone } from "@/src/components/ui";
import { downloadCsv } from "@/src/lib/csv";
import { listCoverImages } from "@/src/lib/db/propertyImages";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Home, Download } from "lucide-react";

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

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-base-content/50 cursor-pointer select-none hover:text-base-content/80";
	const staticHeaderCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-base-content/50";
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
					<button
						key={p.id}
						type="button"
						onClick={() => open(p.id)}
						className="w-full text-left bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors"
					>
						<div className="flex items-start justify-between gap-3">
							<Thumb src={covers?.[p.id]} className="w-14 h-14 rounded-xl shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-base-content line-clamp-2">{p.address_line}</p>
								<p className="text-sm text-base-content/60 mt-0.5 truncate">{p.homeowner_name}{p.city ? ` · ${p.city}` : ""}</p>
							</div>
							<p className="text-sm font-semibold text-base-content/80 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</p>
						</div>
						<div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
							<div className="flex items-center gap-1.5">
								<TypeBadge t={p.listing_type} />
								<StatusBadge status={p.status} />
							</div>
							<p className="text-xs text-base-content/50">{p.size_sqm ? `${p.size_sqm} m²` : ""}</p>
						</div>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-160 text-sm">
						<thead className="bg-base-200/60 border-b border-base-300">
							<tr>
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
									<td className="pl-4 pr-0 py-2">
										<Thumb src={covers?.[p.id]} className="w-11 h-11 rounded-lg" />
									</td>
									<td className="px-4 py-3 text-sm font-medium text-base-content min-w-0">{p.homeowner_name}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 min-w-0">{p.address_line}{p.city ? `, ${p.city}` : ""}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">{p.size_sqm ?? "—"}</td>
									<td className="px-4 py-3"><TypeBadge t={p.listing_type} /></td>
									<td className="px-4 py-3"><StatusBadge status={p.status} /></td>
									<td className="px-4 py-3 text-sm text-base-content/80 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</td>
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
		</>
	);
}
