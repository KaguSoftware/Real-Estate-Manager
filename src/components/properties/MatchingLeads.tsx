"use client";

import Link from "next/link";
import { listLeads } from "@/src/lib/db/leads";
import { rankLeadsForProperty } from "@/src/lib/matching/score";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, Badge } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import type { Property } from "@/src/lib/db/types";
import { Users } from "lucide-react";

/**
 * Reverse of the lead page's "Find matches": which active clients' stated
 * preferences fit THIS property? Scoring lives in lib/matching/score.ts;
 * best matches are listed first with the matched preferences as badges.
 */
export function MatchingLeads({ property }: { property: Property }) {
	const { data } = useCachedResource("leads:for-matching", () => listLeads());
	if (property.status === "sold") return null;

	const matched = rankLeadsForProperty(data ?? [], property);
	if (matched.length === 0) return null;

	return (
		<Card className="mt-4 sm:mt-5">
			<div className="flex items-center gap-2 mb-4">
				<Users className="w-4 h-4 text-slate-400" />
				<CardLabel>Interested clients</CardLabel>
				<span className="text-xs text-slate-400">
					{matched.length} client{matched.length === 1 ? "" : "s"} looking for a place like this
				</span>
			</div>
			<ul className="divide-y divide-slate-100">
				{matched.map(({ lead: l, result }) => (
					<li key={l.id} className="py-2.5 flex items-center gap-3 text-sm">
						<div className="min-w-0 flex-1">
							<Link href="/leads" className="font-medium text-slate-800 hover:underline">
								{l.full_name}
							</Link>
							<p className="text-xs text-slate-400 mt-0.5 truncate">
								{result.reasons.join(" · ") || l.interested_in}
							</p>
						</div>
						<span
							className="text-[11px] font-semibold text-emerald-600 whitespace-nowrap"
							title="Match strength based on how many stated preferences this property satisfies"
						>
							{result.score >= 5 ? "Strong match" : "Match"}
						</span>
						<Badge tone={LEAD_STATUS_META[l.status].tone}>{LEAD_STATUS_META[l.status].label}</Badge>
						{l.phone && (
							<>
								<span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">{l.phone}</span>
								<WhatsAppButton phone={l.phone} name={l.full_name} />
							</>
						)}
					</li>
				))}
			</ul>
		</Card>
	);
}
