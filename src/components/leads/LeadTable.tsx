"use client";

import { useMemo } from "react";
import { useAppStore } from "@/src/store";
import type { Lead } from "@/src/lib/db/types";
import { LEAD_STATUS_META } from "./leadStatus";
import { PhoneCall } from "lucide-react";

function isToday(dateStr: string | null): boolean {
	if (!dateStr) return false;
	const today = new Date().toISOString().slice(0, 10);
	return dateStr.slice(0, 10) === today;
}

function fmtCallDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: Lead["status"] }) {
	const meta = LEAD_STATUS_META[status];
	return (
		<span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${meta.badge}`}>
			{meta.label}
		</span>
	);
}

/** Small "called today" flag so agents don't double-call the same lead. */
function CalledTodayPill() {
	return (
		<span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border bg-blue-50 text-blue-700 border-blue-200">
			<PhoneCall className="w-3 h-3" />
			Today
		</span>
	);
}

interface Props {
	onEdit: (lead: Lead) => void;
}

export function LeadTable({ onEdit }: Props) {
	const leads     = useAppStore((s) => s.leads);
	const isLoading = useAppStore((s) => s.isLoadingLeads);

	// Newest-updated first (the list query already orders this way; keep it stable).
	const sorted = useMemo(
		() => [...leads].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
		[leads],
	);

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	if (leads.length === 0) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center">
				<p className="text-sm text-slate-500">No leads yet.</p>
				<p className="text-xs text-slate-400 mt-1">Click <span className="font-semibold">+ Add lead</span> to add your first client.</p>
			</div>
		);
	}

	const headerCls = "text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-2">
				{sorted.map((l) => (
					<button
						key={l.id}
						type="button"
						onClick={() => onEdit(l)}
						className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 active:bg-slate-50 transition-all"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-bold text-slate-900 truncate">{l.full_name}</p>
								{l.phone && <p className="text-xs text-slate-500 mt-0.5 truncate">{l.phone}</p>}
							</div>
							<StatusBadge status={l.status} />
						</div>
						{l.interested_in && (
							<p className="text-xs text-slate-600 mt-2 line-clamp-2">{l.interested_in}</p>
						)}
						<div className="mt-3 flex items-center justify-between gap-2">
							<span className="text-[10px] text-slate-400">Last call: {fmtCallDate(l.last_call_at)}</span>
							{isToday(l.last_call_at) && <CalledTodayPill />}
						</div>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-slate-50/50 border-b border-slate-100">
							<tr>
								<th className={headerCls}>Name</th>
								<th className={headerCls}>Phone</th>
								<th className={headerCls}>Interested in</th>
								<th className={headerCls}>Status</th>
								<th className={headerCls}>Last call</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((l) => (
								<tr
									key={l.id}
									onClick={() => onEdit(l)}
									className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
								>
									<td className="px-4 py-2.5 text-xs font-medium text-slate-800">{l.full_name}</td>
									<td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{l.phone ?? "—"}</td>
									<td className="px-4 py-2.5 text-xs text-slate-600 max-w-xs truncate">{l.interested_in ?? "—"}</td>
									<td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
									<td className="px-4 py-2.5 text-xs whitespace-nowrap">
										<span className="inline-flex items-center gap-2">
											<span className="text-slate-500">{fmtCallDate(l.last_call_at)}</span>
											{isToday(l.last_call_at) && <CalledTodayPill />}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
