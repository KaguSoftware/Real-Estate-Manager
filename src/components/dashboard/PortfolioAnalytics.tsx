"use client";

import Link from "next/link";
import { useAppStore, useTeamReady } from "@/src/store";
import { getDashboardStats, type PropertyHealthRow } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, Badge, cn } from "@/src/components/ui";
import { fmtMoney } from "@/src/lib/format";
import {
	TrendingUp, FileText, CalendarClock, Wallet, PhoneMissed, Building2,
} from "lucide-react";

const EXPIRY_WINDOW_DAYS = 90;
const MAX_HEALTH_ROWS = 5;

function pct(v: number): string {
	return `%${Math.round(v * 100)}`;
}

function fmtAmount(n: number): string {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
	return new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", {
		day: "numeric", month: "short", year: "numeric",
	});
}

/** True when the lease's end date falls within the next 90 days (not past). */
function endsSoon(row: PropertyHealthRow): boolean {
	if (!row.lease_end_date) return false;
	const end = new Date(`${row.lease_end_date}T00:00:00`).getTime();
	const now = Date.now();
	return end >= now - 24 * 60 * 60 * 1000 && end <= now + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Portfolio health panel: occupancy + this month's collection meters, compact
 * stat tiles (active leases, expiring soon, overdue, silent leads) and the
 * worst-offender rental list — all derived from the same cached "stats" fetch
 * as the KPI cards (no extra queries). Renders nothing until there is
 * something meaningful to show.
 */
export function PortfolioAnalytics() {
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const { data } = useCachedResource(
		user && teamReady ? "stats" : null,
		getDashboardStats,
		undefined,
		{ enabled: !!user && teamReady },
	);
	if (!data) return null;

	const {
		occupancyRate, collectionThisMonth,
		activeLeases, leasesExpiringSoon, overdue, leadsWithNoActivity,
		propertyHealth,
	} = data;
	const collections = Object.entries(collectionThisMonth).filter(([, c]) => c.due > 0);

	const attentionRows = (propertyHealth ?? [])
		.filter((r) => r.overdue_count > 0 || endsSoon(r))
		.slice(0, MAX_HEALTH_ROWS);

	const hasMeters = occupancyRate != null || collections.length > 0;
	const hasStats = activeLeases > 0 || leasesExpiringSoon > 0 || overdue.count > 0 || leadsWithNoActivity > 0;
	if (!hasMeters && !hasStats && attentionRows.length === 0) return null;

	const overdueAmounts = Object.entries(overdue.totalByCurrency)
		.filter(([, amount]) => amount > 0)
		.map(([cur, amount]) => fmtMoney(amount, cur))
		.join(" + ");

	return (
		<Card className="mb-4">
			<div className="flex items-center gap-2 mb-4">
				<TrendingUp className="w-4 h-4 text-base-content/50" />
				<CardLabel>Portföy sağlığı</CardLabel>
			</div>

			{/* Meters: occupancy + this month's collection */}
			{hasMeters && (
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
			)}

			{/* Compact stat tiles */}
			<div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2.5", hasMeters && "mt-5")}>
				<StatTile
					icon={FileText}
					label="Aktif sözleşme"
					value={String(activeLeases)}
				/>
				<StatTile
					icon={CalendarClock}
					label="90 gün içinde bitecek"
					value={String(leasesExpiringSoon)}
					tone={leasesExpiringSoon > 0 ? "warning" : undefined}
				/>
				<StatTile
					icon={Wallet}
					label="Geciken ödeme"
					value={String(overdue.count)}
					sub={overdue.count > 0 && overdueAmounts ? overdueAmounts : undefined}
					tone={overdue.count > 0 ? "error" : undefined}
				/>
				<StatTile
					icon={PhoneMissed}
					label="Hiç aranmamış müşteri"
					value={String(leadsWithNoActivity)}
				/>
			</div>

			{/* Worst-offender rentals */}
			<div className="mt-5">
				<div className="flex items-center gap-1.5 mb-2">
					<Building2 className="w-3.5 h-3.5 text-base-content/50" />
					<p className="text-xs font-semibold text-base-content/60">Dikkat gereken taşınmazlar</p>
				</div>
				{attentionRows.length === 0 ? (
					<p className="text-sm text-base-content/50">Portföyünüz sağlıklı görünüyor ✓</p>
				) : (
					<ul className="divide-y divide-base-300 rounded-xl border border-base-300 overflow-hidden">
						{attentionRows.map((row) => (
							<li key={row.id}>
								<Link
									href={`/properties/${row.id}`}
									className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm hover:bg-base-200 transition-colors"
								>
									<span className="font-medium text-base-content truncate min-w-0 flex-1 basis-full sm:basis-0">
										{row.address_line}
									</span>
									{row.overdue_count > 0 && (
										<Badge tone="red">{row.overdue_count} geciken ödeme</Badge>
									)}
									{endsSoon(row) && row.lease_end_date && (
										<Badge tone="amber">Sözleşme bitiyor: {fmtDate(row.lease_end_date)}</Badge>
									)}
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</Card>
	);
}

function StatTile({
	icon: Icon,
	label,
	value,
	sub,
	tone,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	sub?: string;
	tone?: "warning" | "error";
}) {
	return (
		<div
			className={cn(
				"rounded-xl border px-3 py-2.5 min-w-0",
				tone === "error"
					? "border-error/40 bg-error/10"
					: tone === "warning"
						? "border-warning/40 bg-warning/10"
						: "border-base-300 bg-base-200/40",
			)}
		>
			<div className="flex items-center gap-1.5">
				<Icon
					className={cn(
						"w-3.5 h-3.5 shrink-0",
						tone === "error" ? "text-error" : tone === "warning" ? "text-warning" : "text-base-content/50",
					)}
				/>
				<p className="text-xs font-semibold text-base-content/60 truncate">{label}</p>
			</div>
			<p
				className={cn(
					"font-display text-lg font-semibold mt-1",
					tone === "error" ? "text-error" : tone === "warning" ? "text-warning" : "text-base-content",
				)}
			>
				{value}
			</p>
			{sub && (
				<p className="font-numeric text-xs font-semibold text-error/80 truncate" title={sub}>
					{sub}
				</p>
			)}
		</div>
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
