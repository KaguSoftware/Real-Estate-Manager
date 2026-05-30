"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { AppShell, Button, Card } from "@/src/components/ui";
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

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		setIsLoadingProperties(true);
		setError(null);
		listProperties({
			listing_type: filters.listing_type === "all" ? undefined : filters.listing_type,
			status: filters.status === "all" ? undefined : filters.status,
			q: filters.q || undefined,
			nitelik: filters.nitelik || undefined,
			min_bedrooms: filters.min_bedrooms ?? undefined,
			location: filters.location || undefined,
		})
			.then((rows) => {
				if (!cancelled) setProperties(rows);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			})
			.finally(() => {
				if (!cancelled) setIsLoadingProperties(false);
			});
		return () => {
			cancelled = true;
		};
	}, [user, filters.listing_type, filters.status, filters.q, filters.nitelik, filters.min_bedrooms, filters.location, setProperties, setIsLoadingProperties]);

	return (
		<AppShell
			title="Properties"
			subtitle="Listings, tenants & contracts"
			width="7xl"
			actions={
				user && (
					<Button
						size="sm"
						onClick={() => router.push("/properties/new")}
						className="hidden sm:inline-flex"
					>
						<Plus className="w-4 h-4" />
						Add
					</Button>
				)
			}
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
