"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";

export function PropertyFilters() {
	const filters = useAppStore((s) => s.filters);
	const setFilter = useAppStore((s) => s.setFilter);
	const resetFilters = useAppStore((s) => s.resetFilters);

	// Local input state so we can debounce the search write into the store.
	const [q, setQ] = useState(filters.q);
	useEffect(() => {
		const id = setTimeout(() => {
			if (q !== filters.q) setFilter("q", q);
		}, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q]);

	const hasActiveFilter =
		filters.listing_type !== "all" || filters.status !== "all" || filters.q !== "";

	return (
		<div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
			<input
				type="text"
				placeholder="Search homeowner, address, city…"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				className="flex-1 min-w-0 w-full sm:w-auto px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
			/>

			<select
				value={filters.listing_type}
				onChange={(e) => setFilter("listing_type", e.target.value as typeof filters.listing_type)}
				className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
			>
				<option value="all">All types</option>
				<option value="for_rent">For Rent</option>
				<option value="for_sale">For Sale</option>
			</select>

			<select
				value={filters.status}
				onChange={(e) => setFilter("status", e.target.value as typeof filters.status)}
				className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
			>
				<option value="all">All statuses</option>
				<option value="vacant">Vacant</option>
				<option value="occupied">Occupied</option>
				<option value="sold">Sold</option>
			</select>

			{hasActiveFilter && (
				<button
					onClick={() => { setQ(""); resetFilters(); }}
					className="text-xs text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-2"
				>
					Clear
				</button>
			)}
		</div>
	);
}
