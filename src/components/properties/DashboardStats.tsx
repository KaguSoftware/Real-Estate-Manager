"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { getDashboardStats } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { cn } from "@/src/components/ui";
import { Home, KeyRound, Wallet, Users } from "lucide-react";

function fmtAmount(n: number): string {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
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
					<div key={i} className="h-[88px] rounded-2xl bg-base-200 animate-pulse" />
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
				label="Portföy"
				value={String(properties.vacant + properties.occupied + properties.sold)}
				detail={`${properties.occupied} kirada · ${properties.vacant} boş${properties.sold ? ` · ${properties.sold} satıldı` : ""}`}
				onClick={() => { resetFilters(); router.push("/properties"); }}
				hint="Tüm taşınmazları göster"
			/>
			<StatCard
				icon={KeyRound}
				label="Aylık kira"
				value={rent ?? "—"}
				detail={rent ? "etkin kira sözleşmeleri toplamı" : "etkin kira sözleşmesi yok"}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<StatCard
				icon={Wallet}
				label="Bekleyen tahsilat"
				value={outstanding ?? "0"}
				detail={outstanding ? "etkin sözleşmelerde ödenmemiş" : "tümü ödendi"}
				danger={!!outstanding}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<StatCard
				icon={Users}
				label="Müşteriler"
				value={String(totalLeads)}
				detail={`${activeLeads} etkin · ${leadsByStatus.closed} kapandı`}
				onClick={() => router.push("/leads")}
				hint="Müşterileri aç"
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
			className="text-left bg-base-100 rounded-2xl border border-base-300 shadow-card px-4 py-3.5 min-w-0 hover:border-base-content/30 hover:shadow-pop transition-all cursor-pointer">
			<div className="flex items-center gap-1.5 mb-1">
				<Icon className="w-3.5 h-3.5 text-base-content/50" />
				<p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">{label}</p>
			</div>
			<p
				className={cn(
					"font-bold text-base-content truncate",
					value.length > 12 ? "text-sm leading-6" : "text-lg",
					danger && "text-error",
				)}
				title={value}
			>
				{value}
			</p>
			<p className="text-xs text-base-content/60 mt-0.5 truncate" title={detail}>{detail}</p>
		</button>
	);
}
