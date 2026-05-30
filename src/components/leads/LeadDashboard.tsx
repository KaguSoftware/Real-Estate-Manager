"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import { listLeads } from "@/src/lib/db/leads";
import { AppShell, Button, Card } from "@/src/components/ui";
import { LeadFilters } from "./LeadFilters";
import { LeadTable } from "./LeadTable";
import { LeadForm } from "./LeadForm";
import type { Lead } from "@/src/lib/db/types";
import { Plus } from "lucide-react";

export function LeadDashboard() {
	const user = useAppStore((s) => s.user);
	const leadFilters = useAppStore((s) => s.leadFilters);
	const setLeads = useAppStore((s) => s.setLeads);
	const setIsLoadingLeads = useAppStore((s) => s.setIsLoadingLeads);

	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<{ mode: "create" } | { mode: "edit"; lead: Lead } | null>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		setIsLoadingLeads(true);
		setError(null);
		listLeads({
			status: leadFilters.status === "all" ? undefined : leadFilters.status,
			q: leadFilters.q || undefined,
		})
			.then((rows) => { if (!cancelled) setLeads(rows); })
			.catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
			.finally(() => { if (!cancelled) setIsLoadingLeads(false); });
		return () => { cancelled = true; };
	}, [user, leadFilters.status, leadFilters.q, setLeads, setIsLoadingLeads]);

	return (
		<AppShell
			title="Clients"
			subtitle="Leads, follow-ups & interests"
			width="7xl"
			actions={
				user && (
					<Button
						size="sm"
						onClick={() => setEditing({ mode: "create" })}
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
					<p className="text-sm text-slate-600">Sign in to manage your leads.</p>
					<p className="text-xs text-slate-400 mt-1">Use the Sign in button in the top bar.</p>
				</Card>
			) : (
				<>
					<LeadFilters />

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
