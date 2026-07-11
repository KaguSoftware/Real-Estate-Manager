"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/src/store";
import { updateLead } from "@/src/lib/db/leads";
import { listProperties } from "@/src/lib/db/properties";
import { rankPropertiesForLead } from "@/src/lib/matching/score";
import { humanizeError } from "@/src/lib/errors";
import { invalidateCache, useCachedResource } from "@/src/lib/useCachedResource";
import { toast } from "@/src/components/ui";
import type { Lead } from "@/src/lib/db/types";
import { LEAD_STATUS_META } from "./leadStatus";
import { Badge, Card, SpinnerBlock, EmptyState, Pagination, usePagination } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { Home, PhoneCall, Users } from "lucide-react";

function isToday(dateStr: string | null): boolean {
	if (!dateStr) return false;
	const today = new Date().toISOString().slice(0, 10);
	return dateStr.slice(0, 10) === today;
}

function fmtCallDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Date(dateStr).toLocaleDateString("tr-TR", { month: "short", day: "numeric" });
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
			Bugün
		</Badge>
	);
}

interface Props {
	onEdit: (lead: Lead) => void;
}

export function LeadTable({ onEdit }: Props) {
	const leads     = useAppStore((s) => s.leads);
	const isLoading = useAppStore((s) => s.isLoadingLeads);
	const upsertLead = useAppStore((s) => s.upsertLead);
	const [callBusyId, setCallBusyId] = useState<string | null>(null);

	async function markCalledToday(lead: Lead) {
		setCallBusyId(lead.id);
		try {
			const today = new Date().toISOString();
			// Keep a lightweight contact history by prepending a dated line to
			// the free-text notes, so past calls stay visible in the lead form.
			const logLine = `[${today.slice(0, 10)}] Arandı.`;
			const notes = lead.notes ? `${logLine}\n${lead.notes}` : logLine;
			const updated = await updateLead(lead.id, { last_call_at: today, notes });
			upsertLead(updated);
			// The attention panel's "gone quiet" list depends on last_call_at.
			invalidateCache("attention");
			invalidateCache("leads");
			toast.success(`${lead.full_name} bugün arandı olarak işaretlendi.`);
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setCallBusyId(null);
		}
	}

	// Column-light property fetch reused across the app ("Matches" hints).
	const { data: properties } = useCachedResource("properties:for-matching", () => listProperties());
	const matchCounts = useMemo(() => {
		const counts = new Map<string, number>();
		if (!properties) return counts;
		for (const l of leads) counts.set(l.id, rankPropertiesForLead(l, properties).length);
		return counts;
	}, [leads, properties]);

	const sortedAll = useMemo(
		() => [...leads].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
		[leads],
	);
	const { page, setPage, pageCount, pageItems: sorted, total, pageSize } = usePagination(sortedAll);

	if (isLoading) {
		return <SpinnerBlock />;
	}

	if (leads.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={Users}
					title="Henüz müşteri yok"
					hint="İlk müşterinizi kaydetmek için Ekle'ye dokunun."
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-base-content/50";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{sorted.map((l) => (
					// div (not button) so the WhatsApp link and quick-call button can
					// live inside without invalid interactive nesting.
					<div
						key={l.id}
						role="button"
						tabIndex={0}
						onClick={() => onEdit(l)}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(l); } }}
						className="w-full text-left bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors cursor-pointer"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-base-content truncate">{l.full_name}</p>
								{l.phone && (
									<p className="text-sm text-base-content/60 mt-0.5 truncate">
										{l.phone} <WhatsAppButton phone={l.phone} name={l.full_name} />
									</p>
								)}
							</div>
							<StatusBadge status={l.status} />
						</div>
						{l.interested_in && (
							<p className="text-sm text-base-content/70 mt-2 line-clamp-2">{l.interested_in}</p>
						)}
						<div className="mt-3 flex items-center justify-between gap-2">
							<span className="text-xs text-base-content/50">Son arama: {fmtCallDate(l.last_call_at)}</span>
							{isToday(l.last_call_at) ? (
								<CalledTodayPill />
							) : (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); markCalledToday(l); }}
									disabled={callBusyId === l.id}
									className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-success bg-success/10 active:bg-success/20 transition-colors disabled:opacity-50"
								>
									<PhoneCall className="w-3.5 h-3.5" />
									Bugün arandı
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-140 text-sm">
						<thead className="bg-base-200/60 border-b border-base-300">
							<tr>
								<th className={headerCls}>Ad</th>
								<th className={headerCls}>Telefon</th>
								<th className={headerCls}>İlgilendiği</th>
								<th className={headerCls}>Durum</th>
								<th className={headerCls}>Eşleşmeler</th>
								<th className={headerCls}>Son arama</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((l) => (
								<tr
									key={l.id}
									onClick={() => onEdit(l)}
									className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors cursor-pointer"
								>
									<td className="px-4 py-3 text-sm font-medium text-base-content">{l.full_name}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">
										{l.phone ?? "—"}
										{l.phone && <span className="ml-1"><WhatsAppButton phone={l.phone} name={l.full_name} /></span>}
									</td>
									<td className="px-4 py-3 text-sm text-base-content/70 max-w-xs truncate">{l.interested_in ?? "—"}</td>
									<td className="px-4 py-3"><StatusBadge status={l.status} /></td>
									<td className="px-4 py-3 text-sm whitespace-nowrap">
										{(matchCounts.get(l.id) ?? 0) > 0 ? (
											<span
												className="inline-flex items-center gap-1 text-success font-semibold"
												title="Portföyünüzde bu müşterinin tercihleriyle eşleşen taşınmazlar"
											>
												<Home className="w-3.5 h-3.5" />
												{matchCounts.get(l.id)}
											</span>
										) : (
											<span className="text-base-content/30">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-sm whitespace-nowrap">
										<span className="inline-flex items-center gap-2">
											<span className="text-base-content/60">{fmtCallDate(l.last_call_at)}</span>
											{isToday(l.last_call_at) ? (
												<CalledTodayPill />
											) : (
												<button
													type="button"
													onClick={(e) => { e.stopPropagation(); markCalledToday(l); }}
													disabled={callBusyId === l.id}
													aria-label={`${l.full_name} bugün arandı olarak işaretle`}
													title="Bugün arandı olarak işaretle"
													className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-success hover:bg-success/10 transition-colors disabled:opacity-50"
												>
													<PhoneCall className="w-3.5 h-3.5" />
												</button>
											)}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
			<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />
		</>
	);
}
