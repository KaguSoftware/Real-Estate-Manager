"use client";

import Link from "next/link";
import { useAppStore } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { listLeads } from "@/src/lib/db/leads";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, CardLabel, Badge, type BadgeTone } from "@/src/components/ui";
import { AttentionPanel } from "@/src/components/properties/AttentionPanel";
import { DashboardStats } from "@/src/components/properties/DashboardStats";
import { PortfolioAnalytics } from "./PortfolioAnalytics";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import { fmtMoney } from "@/src/lib/format";
import {
	Home, Users, UserPlus, FilePlus2, ArrowRight,
} from "lucide-react";

const QUICK_ACTIONS = [
	{ href: "/properties/new", label: "Add property", icon: Home },
	{ href: "/leads?new=1", label: "Add client", icon: Users },
	{ href: "/tenants?new=1", label: "Add tenant", icon: UserPlus },
	{ href: "/documents/new", label: "New document", icon: FilePlus2 },
];

function statusTone(status: string): BadgeTone {
	return status === "vacant" ? "slate" : status === "occupied" ? "emerald" : "blue";
}

/** Landing page: cross-section of the whole CRM rather than one entity list. */
export function HomeDashboard() {
	const user = useAppStore((s) => s.user);

	const { data: recentProperties } = useCachedResource(
		user ? "properties:recent" : null,
		() => listProperties({}),
		undefined,
		{ enabled: !!user },
	);
	const { data: recentLeads } = useCachedResource(
		user ? "leads:recent" : null,
		() => listLeads(),
		undefined,
		{ enabled: !!user },
	);

	return (
		<AppShell title="Dashboard" subtitle="Everything at a glance" width="7xl">
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-slate-600">Sign in to see your dashboard.</p>
					<p className="text-xs text-slate-400 mt-1">Use the Sign in button in the top bar.</p>
				</Card>
			) : (
				<>
					<AttentionPanel />
					<DashboardStats />
					<PortfolioAnalytics />

					{/* Quick actions */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
						{QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
							<Link
								key={href}
								href={href}
								className="flex items-center gap-2.5 bg-white rounded-2xl border border-slate-200/80 shadow-card px-4 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:shadow-pop transition-all"
							>
								<Icon className="w-4 h-4 text-primary shrink-0" />
								<span className="truncate">{label}</span>
							</Link>
						))}
					</div>

					{/* Recents */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Card>
							<SectionHeader label="Recent properties" href="/properties" />
							{!recentProperties?.length ? (
								<p className="text-sm text-slate-400 py-4">No properties yet.</p>
							) : (
								<ul className="divide-y divide-slate-100">
									{recentProperties.slice(0, 5).map((p) => (
										<li key={p.id}>
											<Link
												href={`/properties/${p.id}`}
												className="flex items-center gap-3 py-2.5 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-slate-800 truncate">{p.address_line}</p>
													<p className="text-xs text-slate-400 truncate">
														{[p.city, p.nitelik].filter(Boolean).join(" · ") || p.homeowner_name}
													</p>
												</div>
												{p.list_price != null && (
													<span className="text-xs font-semibold text-slate-600 whitespace-nowrap hidden sm:inline">
														{fmtMoney(Number(p.list_price), p.currency)}
													</span>
												)}
												<Badge tone={statusTone(p.status)}>
													{p.status[0].toUpperCase() + p.status.slice(1)}
												</Badge>
											</Link>
										</li>
									))}
								</ul>
							)}
						</Card>

						<Card>
							<SectionHeader label="Recent clients" href="/leads" />
							{!recentLeads?.length ? (
								<p className="text-sm text-slate-400 py-4">No clients yet.</p>
							) : (
								<ul className="divide-y divide-slate-100">
									{recentLeads.slice(0, 5).map((l) => (
										<li key={l.id}>
											<Link
												href="/leads"
												className="flex items-center gap-3 py-2.5 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-slate-800 truncate">{l.full_name}</p>
													<p className="text-xs text-slate-400 truncate">
														{l.interested_in || l.phone || "—"}
													</p>
												</div>
												<Badge tone={LEAD_STATUS_META[l.status].tone}>
													{LEAD_STATUS_META[l.status].label}
												</Badge>
											</Link>
										</li>
									))}
								</ul>
							)}
						</Card>
					</div>
				</>
			)}
		</AppShell>
	);
}

function SectionHeader({ label, href }: { label: string; href: string }) {
	return (
		<div className="flex items-center justify-between mb-2">
			<CardLabel>{label}</CardLabel>
			<Link
				href={href}
				className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
			>
				View all
				<ArrowRight className="w-3.5 h-3.5" />
			</Link>
		</div>
	);
}
