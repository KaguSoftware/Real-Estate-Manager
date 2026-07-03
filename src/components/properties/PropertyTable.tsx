"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import type { Property } from "@/src/lib/db/types";
import { Badge, Button, Card, SpinnerBlock, EmptyState, type BadgeTone } from "@/src/components/ui";
import { downloadCsv } from "@/src/lib/csv";
import { Home, Download } from "lucide-react";

type SortKey = "homeowner_name" | "address_line" | "size_sqm" | "list_price" | "updated_at";
type SortDir = "asc" | "desc";

function fmtPrice(p: number | null, ccy: string) {
	if (p == null) return "—";
	return `${Math.round(p).toLocaleString()} ${ccy}`;
}

function StatusBadge({ status }: { status: Property["status"] }) {
	const tone: BadgeTone =
		status === "vacant" ? "slate" : status === "occupied" ? "emerald" : "blue";
	return <Badge tone={tone}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

function TypeBadge({ t }: { t: Property["listing_type"] }) {
	return (
		<Badge tone={t === "for_rent" ? "indigo" : "amber"}>
			{t === "for_rent" ? "For Rent" : "For Sale"}
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

	function open(id: string) { router.push(`/properties/${id}`); }
	function prefetch(id: string) { router.prefetch(`/properties/${id}`); }

	if (isLoading) {
		return <SpinnerBlock />;
	}

	if (properties.length === 0) {
		return hasActiveFilter ? (
			<Card>
				<EmptyState
					title="No properties match your filters"
					action={
						<Button variant="outline" size="sm" onClick={resetFilters}>
							Clear filters
						</Button>
					}
				/>
			</Card>
		) : (
			<Card>
				<EmptyState
					icon={Home}
					title="No properties yet"
					hint="Tap Add to create your first listing."
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-slate-700";
	const staticHeaderCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400";
	const sortArrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "";

	return (
		<>
			<div className="px-1 mb-2 flex items-center justify-between">
				<p className="text-xs font-medium text-slate-400">
					{properties.length} {properties.length === 1 ? "property" : "properties"}
					{hasActiveFilter ? " matched" : ""}
				</p>
				<button
					type="button"
					onClick={() =>
						downloadCsv(
							"properties",
							["Homeowner", "Address", "City", "Neighborhood", "Type", "Listing", "Status", "Size (m²)", "Bedrooms", "Bathrooms", "Furnished", "Price", "Currency", "Notes"],
							sorted.map((p) => [
								p.homeowner_name, p.address_line, p.city, p.mahalle, p.nitelik,
								p.listing_type === "for_rent" ? "For rent" : "For sale", p.status,
								p.size_sqm, p.bedrooms, p.bathrooms,
								p.furnished == null ? "" : p.furnished ? "yes" : "no",
								p.list_price, p.currency, p.notes,
							]),
						)
					}
					className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
				>
					<Download className="w-3.5 h-3.5" />
					Export CSV
				</button>
			</div>

			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{sorted.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => open(p.id)}
						className="w-full text-left bg-white border border-slate-200/80 rounded-2xl shadow-card p-4 active:bg-slate-50 transition-colors"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-slate-900 line-clamp-2">{p.address_line}</p>
								<p className="text-sm text-slate-500 mt-0.5 truncate">{p.homeowner_name}{p.city ? ` · ${p.city}` : ""}</p>
							</div>
							<p className="text-sm font-semibold text-slate-700 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</p>
						</div>
						<div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
							<div className="flex items-center gap-1.5">
								<TypeBadge t={p.listing_type} />
								<StatusBadge status={p.status} />
							</div>
							<p className="text-xs text-slate-400">{p.size_sqm ? `${p.size_sqm} m²` : ""}</p>
						</div>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-160 text-sm">
						<thead className="bg-slate-50/60 border-b border-slate-100">
							<tr>
								<th className={headerCls} onClick={() => toggle("homeowner_name")}>Homeowner {sortArrow("homeowner_name")}</th>
								<th className={headerCls} onClick={() => toggle("address_line")}>Address {sortArrow("address_line")}</th>
								<th className={headerCls} onClick={() => toggle("size_sqm")}>Size (m²) {sortArrow("size_sqm")}</th>
								<th className={staticHeaderCls}>Type</th>
								<th className={staticHeaderCls}>Status</th>
								<th className={headerCls} onClick={() => toggle("list_price")}>Price {sortArrow("list_price")}</th>
								<th className={headerCls} onClick={() => toggle("updated_at")}>Updated {sortArrow("updated_at")}</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((p) => (
								<tr
									key={p.id}
									onClick={() => open(p.id)}
									onMouseEnter={() => prefetch(p.id)}
									className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
								>
									<td className="px-4 py-3 text-sm font-medium text-slate-800 min-w-0">{p.homeowner_name}</td>
									<td className="px-4 py-3 text-sm text-slate-600 min-w-0">{p.address_line}{p.city ? `, ${p.city}` : ""}</td>
									<td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{p.size_sqm ?? "—"}</td>
									<td className="px-4 py-3"><TypeBadge t={p.listing_type} /></td>
									<td className="px-4 py-3"><StatusBadge status={p.status} /></td>
									<td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</td>
									<td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
										{new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
		</>
	);
}
