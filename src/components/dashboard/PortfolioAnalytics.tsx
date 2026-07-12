"use client";

import { useAppStore } from "@/src/store";
import { getDashboardStats } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel } from "@/src/components/ui";
import { TrendingUp } from "lucide-react";

function pct(v: number): string {
	return `%${Math.round(v * 100)}`;
}

function fmtAmount(n: number): string {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

/**
 * Portfolio health strip: occupancy and this month's rent collection,
 * derived from the same cached "stats" fetch as the KPI cards (no extra
 * queries). Renders nothing until there is something meaningful to show.
 */
export function PortfolioAnalytics() {
	const user = useAppStore((s) => s.user);
	const { data } = useCachedResource(
		user ? "stats" : null,
		getDashboardStats,
		undefined,
		{ enabled: !!user },
	);
	if (!data) return null;

	const { occupancyRate, collectionThisMonth } = data;
	const collections = Object.entries(collectionThisMonth).filter(([, c]) => c.due > 0);
	if (occupancyRate == null && collections.length === 0) return null;

	return (
		<Card className="mb-4">
			<div className="flex items-center gap-2 mb-3">
				<TrendingUp className="w-4 h-4 text-base-content/50" />
				<CardLabel>Portföy sağlığı</CardLabel>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{occupancyRate != null && (
					<Meter
						label="Doluluk"
						ratio={occupancyRate}
						caption={`Kiralanabilir taşınmazlarda doluluk oranı: ${pct(occupancyRate)}`}
					/>
				)}
				{collections.map(([cur, c]) => (
					<Meter
						key={cur}
						label={`Bu ay tahsil edilen (${cur})`}
						ratio={c.due > 0 ? Math.min(c.paid / c.due, 1) : 0}
						caption={`${fmtAmount(c.paid)} / ${fmtAmount(c.due)} ${cur} tahsil edildi`}
						danger={c.paid < c.due}
					/>
				))}
			</div>
		</Card>
	);
}

function Meter({
	label,
	ratio,
	caption,
	danger,
}: {
	label: string;
	ratio: number;
	caption: string;
	danger?: boolean;
}) {
	return (
		<div>
			<div className="flex items-baseline justify-between mb-1.5">
				<p className="text-xs font-semibold text-base-content/55">{label}</p>
				<p className={`font-display text-base font-semibold ${danger ? "text-warning" : "text-base-content"}`}>{pct(ratio)}</p>
			</div>
			<div className="h-2 rounded-full bg-base-200 overflow-hidden" role="meter" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
				<div
					className={`h-full rounded-full transition-all ${danger ? "bg-warning" : "bg-success"}`}
					style={{ width: `${Math.round(ratio * 100)}%` }}
				/>
			</div>
			<p className="text-xs text-base-content/60 mt-1.5">{caption}</p>
		</div>
	);
}
