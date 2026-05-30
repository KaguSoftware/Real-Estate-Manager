"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";

export function PropertyFilters() {
	const filters = useAppStore((s) => s.filters);
	const setFilter = useAppStore((s) => s.setFilter);
	const resetFilters = useAppStore((s) => s.resetFilters);

	// Local input state so we can debounce the text writes into the store.
	const [q, setQ] = useState(filters.q);
	const [nitelik, setNitelik] = useState(filters.nitelik);
	const [location, setLocation] = useState(filters.location);

	// Keep local inputs in sync when filters are set externally
	// (e.g. a lead's "Find matches" pre-fills them before navigation).
	useEffect(() => { setQ(filters.q); }, [filters.q]);
	useEffect(() => { setNitelik(filters.nitelik); }, [filters.nitelik]);
	useEffect(() => { setLocation(filters.location); }, [filters.location]);

	useEffect(() => {
		const id = setTimeout(() => {
			if (q !== filters.q) setFilter("q", q);
		}, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q]);

	useEffect(() => {
		const id = setTimeout(() => {
			if (nitelik !== filters.nitelik) setFilter("nitelik", nitelik);
		}, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [nitelik]);

	useEffect(() => {
		const id = setTimeout(() => {
			if (location !== filters.location) setFilter("location", location);
		}, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location]);

	const hasActiveFilter =
		filters.listing_type !== "all" ||
		filters.status !== "all" ||
		filters.q !== "" ||
		filters.nitelik !== "" ||
		filters.min_bedrooms != null ||
		filters.location !== "";

	return (
		<div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
			<input
				type="text"
				placeholder="Search homeowner, address, city…"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				className="flex-1 min-w-0 w-full sm:w-auto px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
			/>

			<input
				type="text"
				placeholder="Type e.g. 3+1"
				value={nitelik}
				onChange={(e) => setNitelik(e.target.value)}
				className="w-full sm:w-32 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
			/>

			<input
				type="text"
				placeholder="Location / site"
				value={location}
				onChange={(e) => setLocation(e.target.value)}
				className="w-full sm:w-40 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
			/>

			<select
				value={filters.min_bedrooms ?? "all"}
				onChange={(e) =>
					setFilter("min_bedrooms", e.target.value === "all" ? null : Number(e.target.value))
				}
				className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
			>
				<option value="all">Any beds</option>
				<option value="1">1+ beds</option>
				<option value="2">2+ beds</option>
				<option value="3">3+ beds</option>
				<option value="4">4+ beds</option>
			</select>

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
					onClick={() => {
						setQ(""); setNitelik(""); setLocation(""); resetFilters();
					}}
					className="text-xs text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-2"
				>
					Clear
				</button>
			)}
		</div>
	);
}
