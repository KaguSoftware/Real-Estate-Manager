"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/src/store";
import { listLeads } from "@/src/lib/db/leads";
import { UserMenu } from "@/src/components/auth/UserMenu";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { LeadFilters } from "./LeadFilters";
import { LeadTable } from "./LeadTable";
import { LeadForm } from "./LeadForm";
import type { Lead } from "@/src/lib/db/types";
import { Plus, ArrowLeft } from "lucide-react";

export function LeadDashboard() {
	const user = useAppStore((s) => s.user);
	const leadFilters = useAppStore((s) => s.leadFilters);
	const setLeads = useAppStore((s) => s.setLeads);
	const setIsLoadingLeads = useAppStore((s) => s.setIsLoadingLeads);

	const [error, setError] = useState<string | null>(null);
	const [showAuth, setShowAuth] = useState(false);
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
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">Clients & Leads</h1>
						<p className="text-[11px] sm:text-xs text-slate-500 truncate">Track prospects, follow-ups & interests</p>
					</div>
					<div className="flex flex-wrap items-center gap-2 justify-end">
						<Link
							href="/"
							className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
						>
							<ArrowLeft className="w-3.5 h-3.5" />
							Properties
						</Link>
						{user && (
							<button
								onClick={() => setEditing({ mode: "create" })}
								className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
							>
								<Plus className="w-3.5 h-3.5" />
								Add lead
							</button>
						)}
						<UserMenu />
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
				{!user ? (
					<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
						<p className="text-sm text-slate-600 mb-4">Sign in to manage your leads.</p>
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
						<LeadFilters />

						{error && (
							<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
								{error}
							</div>
						)}

						<LeadTable onEdit={(lead) => setEditing({ mode: "edit", lead })} />
					</>
				)}
			</main>

			{editing && (
				<LeadForm
					mode={editing.mode}
					initial={editing.mode === "edit" ? editing.lead : undefined}
					onClose={() => setEditing(null)}
					onDone={() => setEditing(null)}
				/>
			)}
		</div>
	);
}
