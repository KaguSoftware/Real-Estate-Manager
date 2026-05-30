"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import { Input, Select, Button, Sheet, FormField, cn } from "@/src/components/ui";
import { SlidersHorizontal, Search } from "lucide-react";

export function PropertyFilters() {
	const filters = useAppStore((s) => s.filters);
	const setFilter = useAppStore((s) => s.setFilter);
	const resetFilters = useAppStore((s) => s.resetFilters);

	// Local input state so we can debounce the text writes into the store.
	const [q, setQ] = useState(filters.q);
	const [nitelik, setNitelik] = useState(filters.nitelik);
	const [location, setLocation] = useState(filters.location);
	const [sheetOpen, setSheetOpen] = useState(false);

	// Keep local inputs in sync when filters are set externally
	// (e.g. a lead's "Find matches" pre-fills them before navigation).
	useEffect(() => { setQ(filters.q); }, [filters.q]);
	useEffect(() => { setNitelik(filters.nitelik); }, [filters.nitelik]);
	useEffect(() => { setLocation(filters.location); }, [filters.location]);

	useEffect(() => {
		const id = setTimeout(() => { if (q !== filters.q) setFilter("q", q); }, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q]);
	useEffect(() => {
		const id = setTimeout(() => { if (nitelik !== filters.nitelik) setFilter("nitelik", nitelik); }, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [nitelik]);
	useEffect(() => {
		const id = setTimeout(() => { if (location !== filters.location) setFilter("location", location); }, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location]);

	const activeCount =
		(filters.listing_type !== "all" ? 1 : 0) +
		(filters.status !== "all" ? 1 : 0) +
		(filters.nitelik !== "" ? 1 : 0) +
		(filters.min_bedrooms != null ? 1 : 0) +
		(filters.location !== "" ? 1 : 0);
	const hasActiveFilter = activeCount > 0 || filters.q !== "";

	function clearAll() {
		setQ(""); setNitelik(""); setLocation(""); resetFilters();
	}

	// The secondary controls — reused inline on desktop and inside the sheet on mobile.
	const controls = (stacked: boolean) => (
		<div className={cn(stacked ? "space-y-4" : "contents")}>
			<FieldWrap stacked={stacked} label="Type">
				<Input placeholder="e.g. 3+1" value={nitelik} onChange={(e) => setNitelik(e.target.value)}
					className={stacked ? "" : "sm:w-28"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Location / site">
				<Input placeholder="Neighborhood or site" value={location} onChange={(e) => setLocation(e.target.value)}
					className={stacked ? "" : "sm:w-44"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Bedrooms">
				<Select
					value={filters.min_bedrooms ?? "all"}
					onChange={(e) => setFilter("min_bedrooms", e.target.value === "all" ? null : Number(e.target.value))}
					className={stacked ? "" : "sm:w-auto"}
				>
					<option value="all">Any beds</option>
					<option value="1">1+ beds</option>
					<option value="2">2+ beds</option>
					<option value="3">3+ beds</option>
					<option value="4">4+ beds</option>
				</Select>
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Listing">
				<Select value={filters.listing_type}
					onChange={(e) => setFilter("listing_type", e.target.value as typeof filters.listing_type)}
					className={stacked ? "" : "sm:w-auto"}>
					<option value="all">All types</option>
					<option value="for_rent">For Rent</option>
					<option value="for_sale">For Sale</option>
				</Select>
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Status">
				<Select value={filters.status}
					onChange={(e) => setFilter("status", e.target.value as typeof filters.status)}
					className={stacked ? "" : "sm:w-auto"}>
					<option value="all">All statuses</option>
					<option value="vacant">Vacant</option>
					<option value="occupied">Occupied</option>
					<option value="sold">Sold</option>
				</Select>
			</FieldWrap>
		</div>
	);

	return (
		<div className="mb-4">
			{/* Always-visible search + (mobile) Filters trigger */}
			<div className="flex gap-2 items-center">
				<div className="relative flex-1 min-w-0">
					<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
					<Input
						placeholder="Search homeowner, address, city…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Mobile: open the filters sheet */}
				<Button
					variant="outline"
					size="md"
					onClick={() => setSheetOpen(true)}
					className="sm:hidden relative shrink-0"
					aria-label="Filters"
				>
					<SlidersHorizontal className="w-4 h-4" />
					{activeCount > 0 && (
						<span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center">
							{activeCount}
						</span>
					)}
				</Button>
			</div>

			{/* Desktop: inline filter row */}
			<div className="hidden sm:flex flex-wrap gap-2 items-center mt-3">
				{controls(false)}
				{hasActiveFilter && (
					<Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
				)}
			</div>

			{/* Mobile: filters sheet */}
			<Sheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				title="Filters"
				footer={
					<div className="flex gap-2">
						<Button variant="ghost" block onClick={clearAll}>Clear all</Button>
						<Button block onClick={() => setSheetOpen(false)}>Show results</Button>
					</div>
				}
			>
				{controls(true)}
			</Sheet>
		</div>
	);
}

/** On mobile (stacked) wrap each control in a labeled FormField; inline on desktop render bare. */
function FieldWrap({ stacked, label, children }: { stacked: boolean; label: string; children: React.ReactNode }) {
	if (stacked) return <FormField label={label}>{children}</FormField>;
	return <>{children}</>;
}
