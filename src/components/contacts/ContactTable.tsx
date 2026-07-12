"use client";

import { useMemo, useState } from "react";
import { useAppStore, useTeamReady, useIsWritable } from "@/src/store";
import { updateLead, deleteLead } from "@/src/lib/db/leads";
import { deleteTenant } from "@/src/lib/db/tenants";
import { listProperties } from "@/src/lib/db/properties";
import { rankPropertiesForLead } from "@/src/lib/matching/score";
import { humanizeError } from "@/src/lib/errors";
import { invalidateCache, useCachedResource } from "@/src/lib/useCachedResource";
import { toast } from "@/src/components/ui";
import type { Lead, Tenant } from "@/src/lib/db/types";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import { Badge, Button, Card, SpinnerBlock, EmptyState, Pagination, usePagination, BulkActionBar, ConfirmDialog } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { useMultiSelect } from "@/src/hooks/useMultiSelect";
import { downloadCsv } from "@/src/lib/csv";
import { Home, PhoneCall, Users, Pencil, Download, Trash2 } from "lucide-react";

/** A merged row: a CRM lead ("Müşteri") or a contract party ("Kiracı"). */
export type ContactRow =
	| { type: "lead"; id: string; lead: Lead }
	| { type: "tenant"; id: string; tenant: Tenant };

function isToday(dateStr: string | null): boolean {
	if (!dateStr) return false;
	const today = new Date().toISOString().slice(0, 10);
	return dateStr.slice(0, 10) === today;
}

function fmtCallDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Date(dateStr).toLocaleDateString("tr-TR", { month: "short", day: "numeric" });
}

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: Lead["status"] }) {
	const meta = LEAD_STATUS_META[status];
	return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function TypeBadge({ type }: { type: ContactRow["type"] }) {
	return type === "lead" ? <Badge tone="indigo">Müşteri</Badge> : <Badge tone="violet">Kiracı</Badge>;
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
	rows: ContactRow[];
	loading: boolean;
	onEditLead: (lead: Lead) => void;
	onEditTenant: (tenant: Tenant) => void;
}

export function ContactTable({ rows, loading, onEditLead, onEditTenant }: Props) {
	const upsertLead = useAppStore((s) => s.upsertLead);
	const removeLead = useAppStore((s) => s.removeLead);
	const teamReady = useTeamReady();
	const isWritable = useIsWritable();
	const [callBusyId, setCallBusyId] = useState<string | null>(null);

	// Selection keys are "type:id" — lead and tenant ids live in separate tables
	// and could theoretically collide.
	const rowKey = (r: ContactRow) => `${r.type}:${r.id}`;
	const { selected, toggle, toggleAll, clear, isSelected, allSelected, count } = useMultiSelect();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [bulkBusy, setBulkBusy] = useState(false);

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
	const { data: properties } = useCachedResource(
		teamReady ? "properties:for-matching" : null,
		() => listProperties(),
		undefined,
		{ enabled: teamReady },
	);
	const matchCounts = useMemo(() => {
		const counts = new Map<string, number>();
		if (!properties) return counts;
		for (const r of rows) {
			if (r.type === "lead") counts.set(r.lead.id, rankPropertiesForLead(r.lead, properties).length);
		}
		return counts;
	}, [rows, properties]);

	const { page, setPage, pageCount, pageItems, total, pageSize } = usePagination(rows);

	const pageKeys = pageItems.map(rowKey);
	const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

	function exportSelectedCsv() {
		downloadCsv(
			"kisiler-secim",
			["Ad", "Tür", "Telefon", "E-posta", "Detay", "Durum", "Notlar"],
			selectedRows.map((r) => {
				const p = r.type === "lead" ? r.lead : r.tenant;
				return [
					p.full_name,
					r.type === "lead" ? "Müşteri" : "Kiracı",
					p.phone,
					p.email,
					r.type === "lead" ? r.lead.interested_in : r.tenant.national_id,
					r.type === "lead" ? LEAD_STATUS_META[r.lead.status].label : "",
					p.notes,
				];
			}),
		);
	}

	async function bulkDelete() {
		setBulkBusy(true);
		let ok = 0;
		let failed = 0;
		let tenantsDeleted = 0;
		for (const r of selectedRows) {
			try {
				if (r.type === "lead") {
					await deleteLead(r.id);
					removeLead(r.id);
				} else {
					await deleteTenant(r.id);
					tenantsDeleted++;
				}
				ok++;
			} catch {
				failed++;
			}
		}
		if (tenantsDeleted > 0) {
			// Tenants aren't in the store; drop the cache so the dashboard refetches.
			invalidateCache("tenants");
			invalidateCache("stats");
		}
		setBulkBusy(false);
		setConfirmDelete(false);
		clear();
		if (failed === 0) toast.success(`${ok} kişi silindi.`);
		else toast.error(`${ok} kişi silindi, ${failed} kişi silinemedi.`);
	}

	if (loading) return <SpinnerBlock />;

	if (rows.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={Users}
					title="Henüz kayıt yok"
					hint="Müşteri veya kiracı eklemek için Ekle'ye dokunun. Kiracılar sözleşme oluşturduğunuzda da otomatik eklenir."
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-semibold text-base-content/50";
	const onEdit = (r: ContactRow) => (r.type === "lead" ? onEditLead(r.lead) : onEditTenant(r.tenant));

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{pageItems.map((r) => {
					const p = r.type === "lead" ? r.lead : r.tenant;
					return (
						// div (not button) so the WhatsApp link and quick-call button can
						// live inside without invalid interactive nesting.
						<div
							key={`${r.type}:${r.id}`}
							role="button"
							tabIndex={0}
							onClick={() => onEdit(r)}
							onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(r); } }}
							className="w-full text-left bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors cursor-pointer"
						>
							<div className="flex items-start justify-between gap-3">
								<input
									type="checkbox"
									checked={isSelected(rowKey(r))}
									onChange={() => toggle(rowKey(r))}
									onClick={(e) => e.stopPropagation()}
									aria-label={`${p.full_name} kaydını seç`}
									className="checkbox checkbox-sm checkbox-primary mt-1 shrink-0"
								/>
								<div className="min-w-0 flex-1">
									<p className="text-base font-bold text-base-content truncate">{p.full_name}</p>
									{(p.phone || p.email) && (
										<p className="text-sm text-base-content/60 mt-0.5 truncate">
											{p.phone ?? ""}
											{p.phone && <WhatsAppButton phone={p.phone} name={p.full_name} />}
											{p.phone && p.email ? " · " : ""}
											{p.email ?? ""}
										</p>
									)}
								</div>
								<div className="flex flex-col items-end gap-1.5">
									<TypeBadge type={r.type} />
									{r.type === "lead" && <StatusBadge status={r.lead.status} />}
								</div>
							</div>
							{r.type === "lead" && r.lead.interested_in && (
								<p className="text-sm text-base-content/70 mt-2 line-clamp-2">{r.lead.interested_in}</p>
							)}
							{r.type === "lead" ? (
								<div className="mt-3 flex items-center justify-between gap-2">
									<span className="text-xs text-base-content/50">Son arama: {fmtCallDate(r.lead.last_call_at)}</span>
									{isToday(r.lead.last_call_at) ? (
										<CalledTodayPill />
									) : (
										<button
											type="button"
											onClick={(e) => { e.stopPropagation(); markCalledToday(r.lead); }}
											disabled={callBusyId === r.lead.id}
											className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-success bg-success/10 active:bg-success/20 transition-colors disabled:opacity-50"
										>
											<PhoneCall className="w-3.5 h-3.5" />
											Bugün arandı
										</button>
									)}
								</div>
							) : (
								<p className="text-xs text-base-content/50 mt-2">Eklenme: {fmtDate(r.tenant.created_at)}</p>
							)}
						</div>
					);
				})}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-140 text-sm">
						<thead className="bg-base-200/60 border-b border-base-300">
							<tr>
								<th className="px-4 py-3 w-10">
									<input
										type="checkbox"
										checked={allSelected(pageKeys)}
										onChange={() => toggleAll(pageKeys)}
										aria-label="Sayfadaki tüm kişileri seç"
										className="checkbox checkbox-sm checkbox-primary align-middle"
									/>
								</th>
								<th className={headerCls}>Ad</th>
								<th className={headerCls}>Tür</th>
								<th className={headerCls}>Telefon</th>
								<th className={headerCls}>Detay</th>
								<th className={headerCls}>Durum</th>
								<th className={headerCls}>Eşleşmeler</th>
								<th className={headerCls}>Son arama / Eklenme</th>
								<th className={headerCls}><span className="sr-only">İşlemler</span></th>
							</tr>
						</thead>
						<tbody>
							{pageItems.map((r) => {
								const p = r.type === "lead" ? r.lead : r.tenant;
								return (
									<tr
										key={`${r.type}:${r.id}`}
										onClick={() => onEdit(r)}
										className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors cursor-pointer"
									>
										<td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={isSelected(rowKey(r))}
												onChange={() => toggle(rowKey(r))}
												aria-label={`${p.full_name} kaydını seç`}
												className="checkbox checkbox-sm checkbox-primary align-middle"
											/>
										</td>
										<td className="px-4 py-3 text-sm font-medium text-base-content">{p.full_name}</td>
										<td className="px-4 py-3"><TypeBadge type={r.type} /></td>
										<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">
											{p.phone ?? "—"}
											{p.phone && <span className="ml-1"><WhatsAppButton phone={p.phone} name={p.full_name} /></span>}
										</td>
										<td className="px-4 py-3 text-sm text-base-content/70 max-w-xs truncate">
											{r.type === "lead"
												? (r.lead.interested_in ?? "—")
												: [r.tenant.email, r.tenant.national_id].filter(Boolean).join(" · ") || "—"}
										</td>
										<td className="px-4 py-3">
											{r.type === "lead" ? <StatusBadge status={r.lead.status} /> : <span className="text-base-content/30">—</span>}
										</td>
										<td className="px-4 py-3 text-sm whitespace-nowrap">
											{r.type === "lead" && (matchCounts.get(r.lead.id) ?? 0) > 0 ? (
												<span
													className="inline-flex items-center gap-1 text-success font-semibold"
													title="Portföyünüzde bu müşterinin tercihleriyle eşleşen taşınmazlar"
												>
													<Home className="w-3.5 h-3.5" />
													{matchCounts.get(r.lead.id)}
												</span>
											) : (
												<span className="text-base-content/30">—</span>
											)}
										</td>
										<td className="px-4 py-3 text-sm whitespace-nowrap">
											{r.type === "lead" ? (
												<span className="inline-flex items-center gap-2">
													<span className="text-base-content/60">{fmtCallDate(r.lead.last_call_at)}</span>
													{isToday(r.lead.last_call_at) ? (
														<CalledTodayPill />
													) : (
														<button
															type="button"
															onClick={(e) => { e.stopPropagation(); markCalledToday(r.lead); }}
															disabled={callBusyId === r.lead.id}
															aria-label={`${r.lead.full_name} bugün arandı olarak işaretle`}
															title="Bugün arandı olarak işaretle"
															className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-success hover:bg-success/10 transition-colors disabled:opacity-50"
														>
															<PhoneCall className="w-3.5 h-3.5" />
														</button>
													)}
												</span>
											) : (
												<span className="text-base-content/60">{fmtDate(r.tenant.created_at)}</span>
											)}
										</td>
										<td className="px-4 py-3 text-right whitespace-nowrap">
											<button
												type="button"
												onClick={(e) => { e.stopPropagation(); onEdit(r); }}
												aria-label={`${p.full_name} kaydını düzenle`}
												title={r.type === "lead" ? "Bu müşteriyi düzenle" : "Bu kiracıyı düzenle veya sil"}
												className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
											>
												<Pencil className="w-4 h-4" />
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>
			<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />

			<BulkActionBar count={count} label={`${count} kişi seçildi`} onClear={clear}>
				<Button size="sm" variant="outline" onClick={exportSelectedCsv}>
					<Download className="w-4 h-4" />
					CSV indir
				</Button>
				{isWritable && (
					<Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
						<Trash2 className="w-4 h-4" />
						Seçilenleri sil
					</Button>
				)}
			</BulkActionBar>

			<ConfirmDialog
				open={confirmDelete}
				title="Seçilen kişiler silinsin mi?"
				message={`${count} kişi kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
				confirmLabel="Seçilenleri sil"
				loading={bulkBusy}
				onConfirm={bulkDelete}
				onCancel={() => setConfirmDelete(false)}
			/>
		</>
	);
}
