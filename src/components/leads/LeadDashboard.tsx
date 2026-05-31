"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listLeads, type LeadFilter } from "@/src/lib/db/leads";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card } from "@/src/components/ui";
import { LeadFilters } from "./LeadFilters";
import { LeadTable } from "./LeadTable";
import { LeadForm } from "./LeadForm";
import type { Lead } from "@/src/lib/db/types";
import { Plus } from "lucide-react";

export function LeadDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const user = useAppStore((s) => s.user);
	const leadFilters = useAppStore((s) => s.leadFilters);
	const setLeads = useAppStore((s) => s.setLeads);
	const setIsLoadingLeads = useAppStore((s) => s.setIsLoadingLeads);

	// Open the create-client modal when arriving via the global Add menu (/leads?new=1).
	// Read the flag once at mount via a lazy initializer (no setState-in-effect)…
	const openNew = searchParams.get("new") === "1";
	const [editing, setEditing] = useState<{ mode: "create" } | { mode: "edit"; lead: Lead } | null>(
		() => (openNew ? { mode: "create" } : null),
	);

	// …then strip the flag from the URL so a refresh / back doesn't reopen it.
	// router.replace is an external-system call, not a setState, so this is effect-safe.
	useEffect(() => {
		if (openNew) router.replace("/leads");
	}, [openNew, router]);

	// Stale-while-revalidate: navigating back to the same filters serves cached
	// leads instantly and revalidates in the background; only filter changes
	// (or a mutation) trigger an eager refetch.
	const query: LeadFilter = {
		status: leadFilters.status === "all" ? undefined : leadFilters.status,
		q: leadFilters.q || undefined,
	};
	const cacheKey = user ? `leads:${JSON.stringify(query)}` : null;

	const { loading, error } = useCachedResource(
		cacheKey,
		() => listLeads(query),
		setLeads,
		{ enabled: !!user },
	);

	useEffect(() => {
		setIsLoadingLeads(loading);
	}, [loading, setIsLoadingLeads]);

	return (
		<AppShell
			title="Clients"
			subtitle="Leads, follow-ups & interests"
			width="7xl"
		>
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-slate-600">Sign in to manage your leads.</p>
					<p className="text-xs text-slate-400 mt-1">Use the Sign in button in the top bar.</p>
				</Card>
			) : (
				<>
					<LeadFilters onAdd={() => setEditing({ mode: "create" })} />

					{error && (
						<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
							{error}
						</div>
					)}

					<LeadTable onEdit={(lead) => setEditing({ mode: "edit", lead })} />

					<button
						onClick={() => setEditing({ mode: "create" })}
						aria-label="Add lead"
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}

			{editing && (
				<LeadForm
					mode={editing.mode}
					initial={editing.mode === "edit" ? editing.lead : undefined}
					onClose={() => setEditing(null)}
					onDone={() => setEditing(null)}
				/>
			)}
		</AppShell>
	);
}
