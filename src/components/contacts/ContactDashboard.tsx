"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { listLeads, type LeadFilter } from "@/src/lib/db/leads";
import { listTenants } from "@/src/lib/db/tenants";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, Alert, Button, Input, Dropdown, type DropdownOption } from "@/src/components/ui";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "@/src/components/leads/leadStatus";
import { LeadForm } from "@/src/components/leads/LeadForm";
import { TenantForm } from "@/src/components/tenants/TenantForm";
import { ContactTable, type ContactRow } from "./ContactTable";
import type { Lead, LeadStatus, Tenant } from "@/src/lib/db/types";
import { downloadCsv } from "@/src/lib/csv";
import { cn } from "@/src/components/ui/cn";
import { Plus, Search, Download, Users, UserPlus } from "lucide-react";

type TypeFilter = "all" | "lead" | "tenant";

type Editing =
	| { mode: "create-lead" }
	| { mode: "create-tenant" }
	| { mode: "edit-lead"; lead: Lead }
	| { mode: "edit-tenant"; tenant: Tenant }
	| null;

const STATUS_OPTIONS: DropdownOption<LeadStatus | "all">[] = [
	{ value: "all", label: "Tüm durumlar" },
	...LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_META[s].label })),
];

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
	{ value: "all", label: "Tümü" },
	{ value: "lead", label: "Müşteriler" },
	{ value: "tenant", label: "Kiracılar" },
];

/**
 * Unified "Müşteriler" page: CRM leads and contract parties (tenants/buyers/
 * guarantors) in one list. The two entities stay in separate tables — this
 * merges them at the view layer only.
 */
export function ContactDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const leadFilters = useAppStore((s) => s.leadFilters);
	const setLeadFilter = useAppStore((s) => s.setLeadFilter);
	const leads = useAppStore((s) => s.leads);
	const setLeads = useAppStore((s) => s.setLeads);
	const setIsLoadingLeads = useAppStore((s) => s.setIsLoadingLeads);

	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [addOpen, setAddOpen] = useState(false);

	// Open the right create modal when arriving via the global Add menu
	// (/leads?new=lead|tenant; legacy ?new=1 means lead). Read once at mount
	// via a lazy initializer, then strip the flag so refresh/back doesn't reopen.
	const newFlag = searchParams.get("new");
	const [editing, setEditing] = useState<Editing>(() => {
		if (newFlag === "tenant") return { mode: "create-tenant" };
		if (newFlag === "lead" || newFlag === "1") return { mode: "create-lead" };
		return null;
	});
	useEffect(() => {
		if (newFlag) router.replace("/leads");
	}, [newFlag, router]);

	// One search box drives both queries; debounced so we don't refetch per keystroke.
	const [q, setQ] = useState(leadFilters.q);
	const debounceTimer = useRef<number | undefined>(undefined);
	function onSearchChange(value: string) {
		setQ(value);
		window.clearTimeout(debounceTimer.current);
		debounceTimer.current = window.setTimeout(() => setLeadFilter("q", value), 300);
	}

	// Leads: stale-while-revalidate through the global store (DocumentWizard
	// and the matching panel read the same slice).
	const leadQuery: LeadFilter = {
		status: leadFilters.status === "all" ? undefined : leadFilters.status,
		q: leadFilters.q || undefined,
	};
	const leadCacheKey = user && teamReady ? `leads:${JSON.stringify(leadQuery)}` : null;
	const {
		loading: loadingLeads,
		error: leadError,
		refetch: refetchLeads,
	} = useCachedResource(leadCacheKey, () => listLeads(leadQuery), setLeads, { enabled: !!user && teamReady });

	useEffect(() => {
		setIsLoadingLeads(loadingLeads);
	}, [loadingLeads, setIsLoadingLeads]);

	// Tenants: same cached-resource pattern, held locally (no store slice needed).
	const tenantCacheKey = user && teamReady ? `tenants:${JSON.stringify({ q: leadFilters.q })}` : null;
	const {
		data: tenantData,
		loading: loadingTenants,
		error: tenantError,
		refetch: refetchTenants,
	} = useCachedResource(
		tenantCacheKey,
		() => listTenants({ q: leadFilters.q || undefined }),
		undefined,
		{ enabled: !!user && teamReady },
	);
	const tenants = useMemo(() => tenantData ?? [], [tenantData]);

	const rows = useMemo<ContactRow[]>(() => {
		const merged: ContactRow[] = [];
		if (typeFilter !== "tenant") {
			for (const l of leads) merged.push({ type: "lead", id: l.id, lead: l });
		}
		// Lead status doesn't apply to tenants: hide them from "Tümü" while a
		// status filter is active, but always show them on the Kiracılar tab.
		if (typeFilter === "tenant" || (typeFilter === "all" && leadFilters.status === "all")) {
			for (const t of tenants) merged.push({ type: "tenant", id: t.id, tenant: t });
		}
		merged.sort((a, b) => {
			const au = a.type === "lead" ? a.lead.updated_at : a.tenant.updated_at;
			const bu = b.type === "lead" ? b.lead.updated_at : b.tenant.updated_at;
			return bu.localeCompare(au);
		});
		return merged;
	}, [leads, tenants, typeFilter, leadFilters.status]);

	const loading = loadingLeads || loadingTenants;
	const error = leadError ?? tenantError;

	return (
		<AppShell
			title="Müşteriler"
			subtitle="Müşteriler, kiracılar, alıcılar ve kefiller"
			width="7xl"
		>
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-base-content/70">Müşterilerinizi yönetmek için giriş yapın.</p>
					<p className="text-xs text-base-content/50 mt-1">Üst çubuktaki Giriş yap düğmesini kullanın.</p>
				</Card>
			) : (
				<>
					{/* Filter bar: type tabs + search + lead status + add */}
					<div className="mb-4 flex flex-col gap-2">
						<div
							className="inline-flex self-start rounded-xl bg-base-200 p-1"
							role="tablist"
							aria-label="Kayıt türü"
						>
							{TYPE_TABS.map((t) => (
								<button
									key={t.value}
									type="button"
									role="tab"
									aria-selected={typeFilter === t.value}
									onClick={() => setTypeFilter(t.value)}
									className={cn(
										"px-3.5 h-8 rounded-lg text-sm font-semibold transition-colors",
										typeFilter === t.value
											? "bg-base-100 text-base-content shadow-card"
											: "text-base-content/60 hover:text-base-content",
									)}
								>
									{t.label}
								</button>
							))}
						</div>

						<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
							<div className="relative flex-1 min-w-0">
								<Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
								<Input
									placeholder="Ad, telefon veya e-posta ara…"
									value={q}
									onChange={(e) => onSearchChange(e.target.value)}
									className="pl-9"
									aria-label="Kayıt ara"
								/>
							</div>

							{typeFilter !== "tenant" && (
								<Dropdown
									options={STATUS_OPTIONS}
									value={leadFilters.status}
									onChange={(v) => setLeadFilter("status", v)}
									className="sm:w-52"
									aria-label="Müşteri durumu"
								/>
							)}

							<div className="relative hidden sm:block sm:ml-auto shrink-0">
								<Button size="sm" onClick={() => setAddOpen((o) => !o)} aria-haspopup="menu" aria-expanded={addOpen}>
									<Plus className="w-4 h-4" />
									Ekle
								</Button>
								{addOpen && (
									<div className="absolute right-0 z-30 mt-1.5 w-44 rounded-xl border border-base-300 bg-base-100 shadow-pop p-1" role="menu">
										<button
											type="button"
											role="menuitem"
											onClick={() => { setAddOpen(false); setEditing({ mode: "create-lead" }); }}
											className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left text-base-content/80 hover:bg-base-200 transition-colors"
										>
											<Users className="w-4 h-4 text-base-content/60" />
											Müşteri ekle
										</button>
										<button
											type="button"
											role="menuitem"
											onClick={() => { setAddOpen(false); setEditing({ mode: "create-tenant" }); }}
											className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left text-base-content/80 hover:bg-base-200 transition-colors"
										>
											<UserPlus className="w-4 h-4 text-base-content/60" />
											Kiracı ekle
										</button>
									</div>
								)}
							</div>
						</div>
					</div>

					{rows.length > 0 && (
						<div className="px-1 mb-2 flex justify-end gap-4">
							<button
								type="button"
								onClick={() =>
									downloadCsv(
										"musteriler",
										["Ad", "Telefon", "E-posta", "İlgilendiği", "Durum", "Son arama", "Notlar"],
										leads.map((l) => [
											l.full_name, l.phone, l.email, l.interested_in,
											l.status, l.last_call_at?.slice(0, 10), l.notes,
										]),
									)
								}
								className="inline-flex items-center gap-1 text-xs font-medium text-base-content/50 hover:text-base-content/80 transition-colors"
							>
								<Download className="w-3.5 h-3.5" />
								Müşteri CSV
							</button>
							<button
								type="button"
								onClick={() =>
									downloadCsv(
										"kiracilar",
										["Ad soyad", "Telefon", "E-posta", "TC Kimlik No", "Notlar", "Eklenme tarihi"],
										tenants.map((t) => [t.full_name, t.phone, t.email, t.national_id, t.notes, t.created_at?.slice(0, 10)]),
									)
								}
								className="inline-flex items-center gap-1 text-xs font-medium text-base-content/50 hover:text-base-content/80 transition-colors"
							>
								<Download className="w-3.5 h-3.5" />
								Kiracı CSV
							</button>
						</div>
					)}

					{error && (
						<Alert
							className="mb-4"
							action={
								<Button size="sm" variant="outline" onClick={() => { refetchLeads(); refetchTenants(); }}>
									Tekrar dene
								</Button>
							}
						>
							Kayıtlar yüklenemedi: {error}
						</Alert>
					)}

					<ContactTable
						rows={rows}
						loading={loading}
						onEditLead={(lead) => setEditing({ mode: "edit-lead", lead })}
						onEditTenant={(tenant) => setEditing({ mode: "edit-tenant", tenant })}
					/>

					<button
						onClick={() => setEditing({ mode: typeFilter === "tenant" ? "create-tenant" : "create-lead" })}
						aria-label={typeFilter === "tenant" ? "Kiracı ekle" : "Müşteri ekle"}
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}

			{(editing?.mode === "create-lead" || editing?.mode === "edit-lead") && (
				<LeadForm
					mode={editing.mode === "edit-lead" ? "edit" : "create"}
					initial={editing.mode === "edit-lead" ? editing.lead : undefined}
					onClose={() => setEditing(null)}
					onDone={() => setEditing(null)}
				/>
			)}
			{(editing?.mode === "create-tenant" || editing?.mode === "edit-tenant") && (
				<TenantForm
					mode={editing.mode === "edit-tenant" ? "edit" : "create"}
					initial={editing.mode === "edit-tenant" ? editing.tenant : undefined}
					onClose={() => setEditing(null)}
					onDone={() => { setEditing(null); refetchTenants(); }}
				/>
			)}
		</AppShell>
	);
}
