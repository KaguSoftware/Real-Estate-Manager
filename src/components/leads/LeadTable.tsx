"use client";

import { useMemo } from "react";
import { useAppStore } from "@/src/store";
import type { Lead } from "@/src/lib/db/types";
import { LEAD_STATUS_META } from "./leadStatus";
import { Badge, Card } from "@/src/components/ui";
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
	return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Small "called today" flag so agents don't double-call the same lead. */
function CalledTodayPill() {
	return (
		<Badge tone="blue">
			<PhoneCall className="w-3.5 h-3.5" />
			Today
		</Badge>
	);
}

interface Props {
	onEdit: (lead: Lead) => void;
}

export function LeadTable({ onEdit }: Props) {
	const leads     = useAppStore((s) => s.leads);
	const isLoading = useAppStore((s) => s.isLoadingLeads);

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
			<Card className="p-8 sm:p-12 text-center">
				<p className="text-sm text-slate-500">No leads yet.</p>
				<p className="text-xs text-slate-400 mt-1">Tap <span className="font-semibold">Add</span> to add your first client.</p>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{sorted.map((l) => (
					<button
						key={l.id}
						type="button"
						onClick={() => onEdit(l)}
						className="w-full text-left bg-white border border-slate-200/80 rounded-2xl shadow-card p-4 active:bg-slate-50 transition-colors"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-slate-900 truncate">{l.full_name}</p>
								{l.phone && <p className="text-sm text-slate-500 mt-0.5 truncate">{l.phone}</p>}
							</div>
							<StatusBadge status={l.status} />
						</div>
						{l.interested_in && (
							<p className="text-sm text-slate-600 mt-2 line-clamp-2">{l.interested_in}</p>
						)}
						<div className="mt-3 flex items-center justify-between gap-2">
							<span className="text-xs text-slate-400">Last call: {fmtCallDate(l.last_call_at)}</span>
							{isToday(l.last_call_at) && <CalledTodayPill />}
						</div>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-slate-50/60 border-b border-slate-100">
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
									<td className="px-4 py-3 text-sm font-medium text-slate-800">{l.full_name}</td>
									<td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{l.phone ?? "—"}</td>
									<td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{l.interested_in ?? "—"}</td>
									<td className="px-4 py-3"><StatusBadge status={l.status} /></td>
									<td className="px-4 py-3 text-sm whitespace-nowrap">
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
			</Card>
		</>
	);
}
