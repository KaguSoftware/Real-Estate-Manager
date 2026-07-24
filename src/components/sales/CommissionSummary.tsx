"use client";

/**
 * What the office has earned and what is still in the pipeline.
 *
 * The commission rates were captured per contract by the document wizard but
 * were never read back into any screen — this is the missing view. Amounts are
 * grouped by currency and never summed across them (no FX conversion anywhere).
 */

import { useMemo, useState } from "react";
import { useAppStore, useTeamReady } from "@/src/store";
import { listSalesForTeam, type SaleWithProperty } from "@/src/lib/db/sales";
import { listTeamMembers } from "@/src/lib/db/teams";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { saleCommission, summariseCommissions, KDV_RATE } from "@/src/lib/commission";
import { fmtMoney } from "@/src/lib/format";
import { Card, CardLabel, Badge, Dropdown, cn, type DropdownOption } from "@/src/components/ui";
import { Wallet } from "lucide-react";

type Range = "this_year" | "this_month" | "all";

const RANGE_OPTIONS: DropdownOption<Range>[] = [
	{ value: "this_month", label: "Bu ay" },
	{ value: "this_year", label: "Bu yıl" },
	{ value: "all", label: "Tümü" },
];

function rangeStart(range: Range): string | undefined {
	const now = new Date();
	if (range === "this_month") {
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
	}
	if (range === "this_year") return `${now.getFullYear()}-01-01`;
	return undefined;
}

export function CommissionSummary() {
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const [range, setRange] = useState<Range>("this_year");

	const from = rangeStart(range);
	const { data: sales } = useCachedResource<SaleWithProperty[]>(
		user && teamReady ? `sales:commission:${range}` : null,
		() => listSalesForTeam({ from }),
		undefined,
		{ enabled: !!user && teamReady },
	);
	const { data: members } = useCachedResource(
		teamReady ? "team:members" : null,
		() => listTeamMembers(),
		undefined,
		{ enabled: teamReady },
	);

	const summary = useMemo(() => summariseCommissions(sales ?? []), [sales]);

	/** Commission with KDV per assigned agent, by currency. */
	const byAgent = useMemo(() => {
		const map = new Map<string, Record<string, number>>();
		for (const s of sales ?? []) {
			if (s.status !== "closed") continue;
			const { totalWithKdv } = saleCommission(s);
			if (totalWithKdv === 0) continue;
			const agent = s.property?.assigned_to ?? "unassigned";
			const ccy = (s.currency || "TRY").toUpperCase();
			const cur = map.get(agent) ?? {};
			cur[ccy] = (cur[ccy] ?? 0) + totalWithKdv;
			map.set(agent, cur);
		}
		return map;
	}, [sales]);

	const nameFor = (userId: string) => {
		if (userId === "unassigned") return "Atanmamış";
		const m = members?.find((x) => x.user_id === userId);
		return m?.display_name || m?.email || "Bilinmeyen danışman";
	};

	const earnedCurrencies = Object.keys(summary.earned);
	const pipelineCurrencies = Object.keys(summary.pipeline);
	const hasAny = earnedCurrencies.length > 0 || pipelineCurrencies.length > 0;

	return (
		<Card>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Wallet className="w-4 h-4 text-primary/70 shrink-0" />
					<CardLabel>Komisyon</CardLabel>
				</div>
				<Dropdown
					options={RANGE_OPTIONS}
					value={range}
					onChange={setRange}
					className="shrink-0 basis-32"
					aria-label="Dönem"
				/>
			</div>

			{!hasAny ? (
				<p className="text-sm text-base-content/50 mt-3">
					Bu dönemde komisyon kaydı yok. Satış sözleşmesi oluştururken komisyon
					oranı girdiğinizde burada görünür.
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
						<div>
							<p className="text-sm font-medium text-base-content/70">Kazanılan</p>
							<p className="text-xs text-base-content/50 mb-1.5">Tamamlanan satışlar</p>
							{earnedCurrencies.length === 0 ? (
								<p className="text-sm text-base-content/40">—</p>
							) : (
								earnedCurrencies.map((ccy) => (
									<p key={ccy} className="font-semibold tabular-nums">
										{fmtMoney(summary.earned[ccy].total, ccy)}
										<span className="ml-1.5 text-xs font-normal text-base-content/50">
											({summary.earned[ccy].count} satış)
										</span>
									</p>
								))
							)}
						</div>
						<div>
							<p className="text-sm font-medium text-base-content/70">Beklenen</p>
							<p className="text-xs text-base-content/50 mb-1.5">Devam eden satışlar</p>
							{pipelineCurrencies.length === 0 ? (
								<p className="text-sm text-base-content/40">—</p>
							) : (
								pipelineCurrencies.map((ccy) => (
									<p key={ccy} className="font-semibold tabular-nums text-base-content/70">
										{fmtMoney(summary.pipeline[ccy].total, ccy)}
										<span className="ml-1.5 text-xs font-normal text-base-content/50">
											({summary.pipeline[ccy].count} satış)
										</span>
									</p>
								))
							)}
						</div>
					</div>

					{earnedCurrencies.length > 0 && (
						<p className="text-xs text-base-content/50 mt-3">
							Tutarlar %{Math.round(KDV_RATE * 100)} KDV dahildir. Matrah:{" "}
							{earnedCurrencies
								.map((c) => fmtMoney(summary.earned[c].matrah, c))
								.join(" · ")}
						</p>
					)}

					{byAgent.size > 0 && (
						<div className="mt-4 pt-4 border-t border-base-300">
							<p className="text-sm font-medium text-base-content/70 mb-2">
								Danışmana göre (kazanılan)
							</p>
							<ul className="space-y-1.5">
								{[...byAgent.entries()].map(([agentId, totals]) => (
									<li
										key={agentId}
										className={cn(
											"flex items-center justify-between gap-3 text-sm",
											agentId === user?.id && "font-semibold",
										)}
									>
										<span className="truncate">
											{nameFor(agentId)}
											{agentId === user?.id && (
												<Badge tone="indigo" className="ml-2">Siz</Badge>
											)}
										</span>
										<span className="tabular-nums shrink-0">
											{Object.entries(totals)
												.map(([ccy, amount]) => fmtMoney(amount, ccy))
												.join(" · ")}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</>
			)}
		</Card>
	);
}
