"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { UserMenu } from "@/src/components/auth/UserMenu";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { PropertyFilters } from "./PropertyFilters";
import { PropertyTable } from "./PropertyTable";

export function PropertyDashboard() {
	const user = useAppStore((s) => s.user);
	const filters = useAppStore((s) => s.filters);
	const setProperties = useAppStore((s) => s.setProperties);
	const setIsLoadingProperties = useAppStore((s) => s.setIsLoadingProperties);

	const [error, setError] = useState<string | null>(null);
	const [showAuth, setShowAuth] = useState(false);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		setIsLoadingProperties(true);
		setError(null);
		listProperties({
			listing_type: filters.listing_type === "all" ? undefined : filters.listing_type,
			status: filters.status === "all" ? undefined : filters.status,
			q: filters.q || undefined,
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
	}, [user, filters.listing_type, filters.status, filters.q, setProperties, setIsLoadingProperties]);

	return (
		<div className="min-h-screen bg-slate-50">
			{/* Header */}
			<header className="bg-white border-b border-slate-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">Real Estate Manager</h1>
						<p className="text-[11px] sm:text-xs text-slate-500 truncate">Properties, tenants, leases & contracts</p>
					</div>
					<div className="flex flex-wrap items-center gap-2 justify-end">
						{user && (
							<>
								<Link
									href="/properties/new"
									className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors whitespace-nowrap"
								>
									+ Add property
								</Link>
								<Link
									href="/documents/new"
									className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity whitespace-nowrap"
								>
									New document
								</Link>
							</>
						)}
						<UserMenu />
					</div>
				</div>
			</header>

			{/* Body */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
				{!user ? (
					<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
						<p className="text-sm text-slate-600 mb-4">Sign in to manage your properties.</p>
						<button
							onClick={() => setShowAuth(true)}
							className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity"
						>
							Sign in
						</button>
						{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
					</div>
				) : (
					<>
						<PropertyFilters />

						{error && (
							<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
								{error}
							</div>
						)}

						<PropertyTable />
					</>
				)}
			</main>
		</div>
	);
}
