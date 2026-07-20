"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { listLeads } from "@/src/lib/db/leads";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, CardLabel, Badge, type BadgeTone } from "@/src/components/ui";
import { AttentionPanel } from "@/src/components/properties/AttentionPanel";
import { DashboardStats } from "@/src/components/properties/DashboardStats";
import { PortfolioAnalytics } from "./PortfolioAnalytics";
import { CommissionSummary } from "@/src/components/sales/CommissionSummary";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import { fmtMoney } from "@/src/lib/format";
import {
	Home, Users, UserPlus, FilePlus2, ArrowRight,
} from "lucide-react";

const QUICK_ACTIONS = [
	{ href: "/properties/new", label: "Taşınmaz ekle", icon: Home },
	{ href: "/leads?new=1", label: "Müşteri ekle", icon: Users },
	{ href: "/tenants?new=1", label: "Kiracı ekle", icon: UserPlus },
	{ href: "/documents/new", label: "Yeni belge", icon: FilePlus2 },
];

const PROPERTY_STATUS_LABEL: Record<string, string> = {
	vacant: "Boş",
	occupied: "Kirada",
	sold: "Satıldı",
};

function statusTone(status: string): BadgeTone {
	return status === "vacant" ? "slate" : status === "occupied" ? "emerald" : "blue";
}

/** Landing page: cross-section of the whole CRM rather than one entity list. */
export function HomeDashboard() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const teamLoaded = useAppStore((s) => s.teamLoaded);

	// Client-side counterpart of the proxy's no-team redirect: soft navigations
	// (e.g. right after signup) never hit the middleware, so a signed-in user
	// without a team would sit on an empty dashboard until a hard refresh.
	useEffect(() => {
		if (user && teamLoaded && !team) router.replace("/onboarding");
	}, [user, teamLoaded, team, router]);

	const teamReady = teamLoaded && team != null;
	// Deliberately the SAME cache key and fetcher as /properties ("properties:all")
	// rather than a private "properties:recent": it is the identical query, so
	// sharing the key means the dashboard and the portfolio page hydrate each
	// other. Landing here first makes /properties paint instantly, and vice
	// versa, instead of each paying its own ~330ms round-trip for the same rows.
	const { data: recentProperties } = useCachedResource(
		user && teamReady ? "properties:all" : null,
		() => listProperties({}),
		undefined,
		{ enabled: !!user && teamReady },
	);
	const { data: recentLeads } = useCachedResource(
		user && teamReady ? "leads:recent" : null,
		() => listLeads(),
		undefined,
		{ enabled: !!user && teamReady },
	);

	return (
		<AppShell title="Genel bakış" subtitle="Her şey bir bakışta" width="7xl">
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-base-content/70">Genel bakışı görmek için giriş yapın.</p>
					<p className="text-xs text-base-content/50 mt-1">Üst çubuktaki &quot;Giriş yap&quot; düğmesini kullanın.</p>
				</Card>
			) : (
				<>
					<AttentionPanel />
					<DashboardStats />
					<div className="mb-4">
						<CommissionSummary />
					</div>
					<PortfolioAnalytics />

					{/* Quick actions */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
						{QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
							<Link
								key={href}
								href={href}
								className="flex items-center gap-2.5 bg-base-100 rounded-2xl border border-base-300 shadow-card px-4 py-3.5 text-sm font-semibold text-base-content/80 hover:border-base-content/30 hover:shadow-pop transition-all"
							>
								<Icon className="w-4 h-4 text-primary shrink-0" />
								<span className="truncate">{label}</span>
							</Link>
						))}
					</div>

					{/* Recents */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						<Card>
							<SectionHeader label="Son eklenen taşınmazlar" href="/properties" />
							{!recentProperties?.length ? (
								<p className="text-sm text-base-content/50 py-4">Henüz taşınmaz yok.</p>
							) : (
								<ul className="divide-y divide-base-300">
									{recentProperties.slice(0, 5).map((p) => (
										<li key={p.id}>
											<Link
												href={`/properties/${p.id}`}
												className="flex items-center gap-3 py-2.5 text-sm hover:bg-base-200 -mx-2 px-2 rounded-lg transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-base-content truncate">{p.address_line}</p>
													<p className="text-xs text-base-content/50 truncate">
														{[p.city, p.nitelik].filter(Boolean).join(" · ") || p.homeowner_name}
													</p>
												</div>
												{p.list_price != null && (
													<span className="font-numeric text-xs font-semibold text-base-content/70 whitespace-nowrap hidden sm:inline">
														{fmtMoney(Number(p.list_price), p.currency)}
													</span>
												)}
												<Badge tone={statusTone(p.status)}>
													{PROPERTY_STATUS_LABEL[p.status] ?? p.status}
												</Badge>
											</Link>
										</li>
									))}
								</ul>
							)}
						</Card>

						<Card>
							<SectionHeader label="Son eklenen müşteriler" href="/leads" />
							{!recentLeads?.length ? (
								<p className="text-sm text-base-content/50 py-4">Henüz müşteri yok.</p>
							) : (
								<ul className="divide-y divide-base-300">
									{recentLeads.slice(0, 5).map((l) => (
										<li key={l.id}>
											<Link
												href="/leads"
												className="flex items-center gap-3 py-2.5 text-sm hover:bg-base-200 -mx-2 px-2 rounded-lg transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-base-content truncate">{l.full_name}</p>
													<p className="text-xs text-base-content/50 truncate">
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
				Tümünü gör
				<ArrowRight className="w-3.5 h-3.5" />
			</Link>
		</div>
	);
}
