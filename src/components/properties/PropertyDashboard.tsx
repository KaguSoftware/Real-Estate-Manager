"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listProperties, type PropertyFilter } from "@/src/lib/db/properties";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card } from "@/src/components/ui";
import { PropertyFilters } from "./PropertyFilters";
import { PropertyTable } from "./PropertyTable";
import { PropertyMap } from "./PropertyMap";
import { Plus } from "lucide-react";

export function PropertyDashboard() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const filters = useAppStore((s) => s.filters);
	const setProperties = useAppStore((s) => s.setProperties);
	const setIsLoadingProperties = useAppStore((s) => s.setIsLoadingProperties);

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
	const cacheKey = user ? `properties:${JSON.stringify(query)}` : null;

	const { loading, error } = useCachedResource(
		cacheKey,
		() => listProperties(query),
		setProperties,
		{ enabled: !!user },
	);

	// Mirror the initial-load flag into the store so PropertyTable can show its
	// spinner. Background revalidation (loading === false) never shows a spinner.
	useEffect(() => {
		setIsLoadingProperties(loading);
	}, [loading, setIsLoadingProperties]);

	return (
		<AppShell
			title="Properties"
			subtitle="Listings, tenants & contracts"
			width="7xl"
		>
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-slate-600">Sign in to manage your properties.</p>
					<p className="text-xs text-slate-400 mt-1">Use the Sign in button in the top bar.</p>
				</Card>
			) : (
				<>
					<PropertyMap />
					<PropertyFilters />

					{error && (
						<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
							{error}
						</div>
					)}

					<PropertyTable />

					{/* Mobile FAB — thumb-reachable primary action. */}
					<button
						onClick={() => router.push("/properties/new")}
						aria-label="Add property"
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}
		</AppShell>
	);
}
