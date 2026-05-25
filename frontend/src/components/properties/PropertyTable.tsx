"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import type { Property } from "@/src/lib/db/types";

type SortKey = "homeowner_name" | "address_line" | "size_sqm" | "list_price" | "updated_at";
type SortDir = "asc" | "desc";

function fmtPrice(p: number | null, ccy: string) {
	if (p == null) return "—";
	return `${p.toFixed(0)} ${ccy}`;
}

function StatusBadge({ status }: { status: Property["status"] }) {
	const cls =
		status === "vacant"   ? "bg-slate-100 text-slate-600 border-slate-200" :
		status === "occupied" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
		"bg-blue-50 text-blue-700 border-blue-200";
	const label = status[0].toUpperCase() + status.slice(1);
	return (
		<span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${cls}`}>
			{label}
		</span>
	);
}

function TypeBadge({ t }: { t: Property["listing_type"] }) {
	const cls = t === "for_rent"
		? "bg-indigo-50 text-indigo-700 border-indigo-200"
		: "bg-amber-50 text-amber-700 border-amber-200";
	const label = t === "for_rent" ? "For Rent" : "For Sale";
	return (
		<span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${cls}`}>
			{label}
		</span>
	);
}

export function PropertyTable() {
	const router = useRouter();
	const properties = useAppStore((s) => s.properties);
	const isLoading  = useAppStore((s) => s.isLoadingProperties);

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
		return (
			<div className="flex justify-center py-12">
				<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (properties.length === 0) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center">
				<p className="text-sm text-slate-500">No properties yet.</p>
				<p className="text-xs text-slate-400 mt-1">Click <span className="font-semibold">+ Add property</span> to create your first listing.</p>
			</div>
		);
	}

	const headerCls = "text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-700";
	const staticHeaderCls = "text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400";
	const sortArrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-2">
				{sorted.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => open(p.id)}
						className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 active:bg-slate-50 transition-all"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-bold text-slate-900 line-clamp-2 wrap-break-word">{p.address_line}</p>
								<p className="text-xs text-slate-500 mt-0.5 truncate">{p.homeowner_name}{p.city ? ` · ${p.city}` : ""}</p>
							</div>
							<p className="text-sm font-semibold text-slate-700 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</p>
						</div>
						<div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
							<div className="flex items-center gap-1.5">
								<TypeBadge t={p.listing_type} />
								<StatusBadge status={p.status} />
							</div>
							<p className="text-[10px] text-slate-400">
								{p.size_sqm ? `${p.size_sqm} m²` : ""}
							</p>
						</div>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-slate-50/50 border-b border-slate-100">
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
									<td className="px-4 py-2.5 text-xs font-medium text-slate-800 min-w-0">{p.homeowner_name}</td>
									<td className="px-4 py-2.5 text-xs text-slate-600 min-w-0">
										{p.address_line}{p.city ? `, ${p.city}` : ""}
									</td>
									<td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{p.size_sqm ?? "—"}</td>
									<td className="px-4 py-2.5"><TypeBadge t={p.listing_type} /></td>
									<td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
									<td className="px-4 py-2.5 text-xs text-slate-700 whitespace-nowrap">{fmtPrice(p.list_price, p.currency)}</td>
									<td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
										{new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
