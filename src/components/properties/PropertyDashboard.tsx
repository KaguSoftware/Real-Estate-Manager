"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { listProperties, type PropertyFilter } from "@/src/lib/db/properties";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, Alert, Button } from "@/src/components/ui";
import { PropertyFilters } from "./PropertyFilters";
import { PropertyTable } from "./PropertyTable";
import { PropertyMap } from "./PropertyMap";
import { Plus } from "lucide-react";

/** Serialize non-default filter values so views are shareable/bookmarkable. */
function filtersToParams(filters: {
	listing_type: string; status: string; q: string;
	nitelik: string[]; furnished: string; location: string[];
}): string {
	const p = new URLSearchParams();
	if (filters.listing_type !== "all") p.set("type", filters.listing_type);
	if (filters.status !== "all") p.set("status", filters.status);
	if (filters.furnished !== "all") p.set("furnished", filters.furnished);
	if (filters.q) p.set("q", filters.q);
	if (filters.nitelik.length) p.set("nitelik", filters.nitelik.join(","));
	if (filters.location.length) p.set("loc", filters.location.join(","));
	return p.toString();
}

export function PropertyDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const filters = useAppStore((s) => s.filters);
	const setFilters = useAppStore((s) => s.setFilters);
	const setProperties = useAppStore((s) => s.setProperties);
	const setIsLoadingProperties = useAppStore((s) => s.setIsLoadingProperties);

	// One-time hydration: an arriving URL with filter params wins over the store,
	// so shared/bookmarked links reproduce the same view. Afterwards the store is
	// the source of truth and is mirrored back into the URL below.
	const hydrated = useRef(false);
	useEffect(() => {
		if (hydrated.current) return;
		hydrated.current = true;
		const type = searchParams.get("type");
		const status = searchParams.get("status");
		const furnished = searchParams.get("furnished");
		const q = searchParams.get("q");
		const nitelik = searchParams.get("nitelik");
		const loc = searchParams.get("loc");
		if (!type && !status && !furnished && !q && !nitelik && !loc) return;
		setFilters({
			...(type === "for_rent" || type === "for_sale" ? { listing_type: type } : {}),
			...(status === "vacant" || status === "occupied" || status === "sold" ? { status } : {}),
			...(furnished === "yes" || furnished === "no" ? { furnished } : {}),
			...(q ? { q } : {}),
			...(nitelik ? { nitelik: nitelik.split(",").filter(Boolean) } : {}),
			...(loc ? { location: loc.split(",").filter(Boolean) } : {}),
		});
	}, [searchParams, setFilters]);

	// Mirror filter changes into the URL (replace, so history isn't spammed).
	useEffect(() => {
		if (!hydrated.current) return;
		const qs = filtersToParams(filters);
		const current = searchParams.toString();
		if (qs !== current) router.replace(qs ? `/properties?${qs}` : "/properties", { scroll: false });
	}, [filters, router, searchParams]);

	// Normalize filters into a query object + a stable cache key. Navigating back
	// to the same filters serves the cached list instantly and revalidates in the
	// background (stale-while-revalidate); only real filter changes refetch eagerly.
	const query: PropertyFilter = {
		listing_type: filters.listing_type === "all" ? undefined : filters.listing_type,
		status: filters.status === "all" ? undefined : filters.status,
		q: filters.q || undefined,
		nitelik: filters.nitelik.length ? filters.nitelik : undefined,
		furnished: filters.furnished === "all" ? undefined : filters.furnished === "yes",
		location: filters.location.length ? filters.location : undefined,
	};
	const cacheKey = user && teamReady ? `properties:${JSON.stringify(query)}` : null;

	const { loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listProperties(query),
		setProperties,
		{ enabled: !!user && teamReady },
	);

	// Mirror the initial-load flag into the store so PropertyTable can show its
	// spinner. Background revalidation (loading === false) never shows a spinner.
	useEffect(() => {
		setIsLoadingProperties(loading);
	}, [loading, setIsLoadingProperties]);

	return (
		<AppShell
			title="Portföy"
			subtitle="İlanlar, kiracılar ve sözleşmeler"
			width="7xl"
		>
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-base-content/70">Portföyünüzü yönetmek için giriş yapın.</p>
					<p className="text-xs text-base-content/50 mt-1">Üst çubuktaki Giriş yap düğmesini kullanın.</p>
				</Card>
			) : (
				<>
					<PropertyMap />
					<PropertyFilters />

					{error && (
						<Alert
							className="mb-4"
							action={<Button size="sm" variant="outline" onClick={refetch}>Tekrar dene</Button>}
						>
							Portföy yüklenemedi: {error}
						</Alert>
					)}

					<PropertyTable />

					{/* Mobile FAB — thumb-reachable primary action. */}
					<button
						onClick={() => router.push("/properties/new")}
						aria-label="Taşınmaz ekle"
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}
		</AppShell>
	);
}
