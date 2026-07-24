"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { listProjects } from "@/src/lib/db/projects";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, Badge } from "@/src/components/ui";
import type { Project } from "@/src/lib/db/types";
import { Building2, ExternalLink } from "lucide-react";

interface Props {
	/** Active budget filter. Both bounds may be null (open-ended). */
	minPrice: number | null;
	maxPrice: number | null;
	/** Currency the bounds are stated in — never FX-converted. */
	currency: string;
}

/**
 * "Projeler de var" — construction projects whose entry price fits the budget
 * currently being filtered on.
 *
 * Deliberately NOT part of scoreLeadProperty: that engine scores property rows,
 * and a project may legitimately have none (its detail lives in the developer's
 * Drive folder). This is a secondary, visually lighter prompt that sits beside
 * the real property results and disappears entirely when nothing fits.
 */
export function MatchingProjects({ minPrice, maxPrice, currency }: Props) {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const projects = useAppStore((s) => s.projects);
	const setProjects = useAppStore((s) => s.setProjects);

	const hasBudget = minPrice != null || maxPrice != null;

	useCachedResource(
		user && teamReady && hasBudget ? "projects:for-matching" : null,
		() => listProjects(),
		setProjects,
		{ enabled: !!user && teamReady && hasBudget },
	);

	const matches = useMemo<Project[]>(() => {
		if (!hasBudget) return [];
		return projects.filter((p) => {
			if (p.price_from == null) return false;
			// Same rule as the property scorer: a price is only comparable within
			// one currency, because nothing here is FX-converted.
			if (p.price_currency !== currency) return false;
			if (minPrice != null && p.price_from < minPrice) return false;
			if (maxPrice != null && p.price_from > maxPrice) return false;
			return true;
		});
	}, [projects, hasBudget, minPrice, maxPrice, currency]);

	if (matches.length === 0) return null;

	return (
		<Card className="mb-4">
			<div className="flex items-center gap-2">
				<Building2 className="w-4 h-4 text-primary/70 shrink-0" />
				<CardLabel>Bu bütçeye uyan projeler</CardLabel>
				<Badge tone="slate">{matches.length}</Badge>
			</div>
			<p className="text-sm text-base-content/60 mt-1">
				Portföyde ayrı kaydı olmayan, müteahhit firma projeleri.
			</p>

			<ul className="mt-3 flex flex-col gap-2">
				{matches.map((p) => (
					<li key={p.id}>
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-300/70 bg-base-200/40 px-3 py-2.5">
							<button
								type="button"
								onClick={() => router.push(`/projects/${p.id}`)}
								className="min-w-0 text-left hover:underline"
							>
								<span className="block font-medium truncate">{p.name}</span>
								<span className="block text-sm text-base-content/60 truncate">
									{[p.developer_name, p.mahalle ?? p.city].filter(Boolean).join(" · ") || "—"}
								</span>
							</button>
							<span className="flex items-center gap-3 shrink-0">
								<span className="tabular-nums text-sm font-medium">
									{Math.round(p.price_from!).toLocaleString("tr-TR")} {p.price_currency}
								</span>
								{p.drive_url && (
									<a
										href={p.drive_url}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
									>
										<ExternalLink className="w-3.5 h-3.5" />
										Drive
									</a>
								)}
							</span>
						</div>
					</li>
				))}
			</ul>
		</Card>
	);
}
