"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getDashboardStats } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { cn } from "@/src/components/ui";
import { Home, KeyRound, Wallet, Users } from "lucide-react";

function fmtAmount(n: number): string {
	return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** "12,500 TRY · 300 USD" from a currency→amount map; null when empty. */
function joinByCurrency(map: Record<string, number>): string | null {
	const parts = Object.entries(map).map(([cur, amt]) => `${fmtAmount(amt)} ${cur}`);
	return parts.length ? parts.join(" · ") : null;
}

/** KPI strip above the dashboard map. */
export function DashboardStats() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const setFilters = useAppStore((s) => s.setFilters);
	const resetFilters = useAppStore((s) => s.resetFilters);
	const { data, loading } = useCachedResource(
		user ? "stats" : null,
		getDashboardStats,
		undefined,
		{ enabled: !!user },
	);

	if (loading && !data) {
		return (
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="h-[88px] rounded-2xl bg-slate-100 animate-pulse" />
				))}
			</div>
		);
	}
	if (!data) return null;

	const { properties, monthlyRentByCurrency, outstandingByCurrency, leadsByStatus, totalLeads } = data;
	const rent = joinByCurrency(monthlyRentByCurrency);
	const outstanding = joinByCurrency(outstandingByCurrency);
	const activeLeads = leadsByStatus.new + leadsByStatus.follow_up + leadsByStatus.interested;

	return (
		<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
			<StatCard
				icon={Home}
				label="Properties"
				value={String(properties.vacant + properties.occupied + properties.sold)}
				detail={`${properties.occupied} occupied · ${properties.vacant} vacant${properties.sold ? ` · ${properties.sold} sold` : ""}`}
				onClick={resetFilters}
				hint="Show all properties"
			/>
			<StatCard
				icon={KeyRound}
				label="Monthly rent"
				value={rent ?? "—"}
				detail={rent ? "across active leases" : "no active leases"}
				onClick={() => setFilters({ status: "occupied" })}
				hint="Show occupied properties"
			/>
			<StatCard
				icon={Wallet}
				label="Outstanding"
				value={outstanding ?? "0"}
				detail={outstanding ? "unpaid across active leases" : "all settled"}
				danger={!!outstanding}
				onClick={() => setFilters({ status: "occupied" })}
				hint="Show occupied properties"
			/>
			<StatCard
				icon={Users}
				label="Leads"
				value={String(totalLeads)}
				detail={`${activeLeads} active · ${leadsByStatus.closed} closed`}
				onClick={() => router.push("/leads")}
				hint="Open clients"
			/>
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	detail,
	danger,
	onClick,
	hint,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	detail: string;
	danger?: boolean;
	onClick?: () => void;
	hint?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={hint}
			className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-card px-4 py-3.5 min-w-0 hover:border-slate-300 hover:shadow-pop transition-all cursor-pointer">
			<div className="flex items-center gap-1.5 mb-1">
				<Icon className="w-3.5 h-3.5 text-slate-400" />
				<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
			</div>
			<p
				className={cn(
					"font-bold text-slate-900 truncate",
					value.length > 12 ? "text-sm leading-6" : "text-lg",
					danger && "text-red-600",
				)}
				title={value}
			>
				{value}
			</p>
			<p className="text-xs text-slate-500 mt-0.5 truncate" title={detail}>{detail}</p>
		</button>
	);
}
