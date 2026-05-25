"use client";

import { useState, useMemo } from "react";
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
	const properties = useAppStore((s) => s.properties);
	const isLoading  = useAppStore((s) => s.isLoadingProperties);
	const selectProperty = useAppStore((s) => s.selectProperty);

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

	const headerCls = "text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-700";
	const sortArrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "";

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (properties.length === 0) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
				<p className="text-sm text-slate-500">No properties yet.</p>
				<p className="text-xs text-slate-400 mt-1">Click <span className="font-semibold">+ Add property</span> to create your first listing.</p>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="bg-slate-50/50 border-b border-slate-100">
						<tr>
							<th className={headerCls} onClick={() => toggle("homeowner_name")}>Homeowner {sortArrow("homeowner_name")}</th>
							<th className={headerCls} onClick={() => toggle("address_line")}>Address {sortArrow("address_line")}</th>
							<th className={headerCls} onClick={() => toggle("size_sqm")}>Size (m²) {sortArrow("size_sqm")}</th>
							<th className={headerCls.replace("cursor-pointer select-none hover:text-slate-700", "")}>Type</th>
							<th className={headerCls.replace("cursor-pointer select-none hover:text-slate-700", "")}>Status</th>
							<th className={headerCls} onClick={() => toggle("list_price")}>Price {sortArrow("list_price")}</th>
							<th className={headerCls} onClick={() => toggle("updated_at")}>Updated {sortArrow("updated_at")}</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((p) => (
							<tr
								key={p.id}
								onClick={() => selectProperty(p.id)}
								className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
							>
								<td className="px-4 py-2.5 text-xs font-medium text-slate-800 truncate max-w-[150px]">{p.homeowner_name}</td>
								<td className="px-4 py-2.5 text-xs text-slate-600 truncate max-w-[220px]">
									{p.address_line}{p.city ? `, ${p.city}` : ""}
								</td>
								<td className="px-4 py-2.5 text-xs text-slate-600">{p.size_sqm ?? "—"}</td>
								<td className="px-4 py-2.5"><TypeBadge t={p.listing_type} /></td>
								<td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
								<td className="px-4 py-2.5 text-xs text-slate-700">{fmtPrice(p.list_price, p.currency)}</td>
								<td className="px-4 py-2.5 text-xs text-slate-400">
									{new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
