"use client";

import Link from "next/link";
import { listLeads } from "@/src/lib/db/leads";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, Badge } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import type { Lead, Property } from "@/src/lib/db/types";
import { Users } from "lucide-react";

const ACTIVE_STATUSES: Lead["status"][] = ["new", "follow_up", "interested"];

/**
 * Reverse of the lead page's "Find matches": which active clients' stated
 * preferences fit THIS property? Leads with no preferences at all are skipped —
 * matching everyone is matching no one.
 */
function matches(lead: Lead, p: Property): boolean {
	if (!ACTIVE_STATUSES.includes(lead.status)) return false;
	const hasAnyPref =
		lead.pref_listing_type || lead.pref_nitelik ||
		lead.pref_min_bedrooms != null || lead.pref_location;
	if (!hasAnyPref) return false;

	if (lead.pref_listing_type && lead.pref_listing_type !== p.listing_type) return false;
	if (lead.pref_nitelik && lead.pref_nitelik !== p.nitelik) return false;
	if (lead.pref_min_bedrooms != null && (p.bedrooms == null || p.bedrooms < lead.pref_min_bedrooms))
		return false;
	if (lead.pref_location) {
		const haystack = [p.city, p.mahalle, p.mevkii, p.address_line]
			.filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
		if (!haystack.includes(lead.pref_location.toLocaleLowerCase("tr-TR"))) return false;
	}
	return true;
}

export function MatchingLeads({ property }: { property: Property }) {
	const { data } = useCachedResource("leads:for-matching", () => listLeads());
	if (property.status === "sold") return null;

	const matched = (data ?? []).filter((l) => matches(l, property));
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
				{matched.map((l) => (
					<li key={l.id} className="py-2.5 flex items-center gap-3 text-sm">
						<div className="min-w-0 flex-1">
							<Link href="/leads" className="font-medium text-slate-800 hover:underline">
								{l.full_name}
							</Link>
							<p className="text-xs text-slate-400 mt-0.5 truncate">
								{[
									l.pref_listing_type ? (l.pref_listing_type === "for_rent" ? "renting" : "buying") : null,
									l.pref_nitelik,
									l.pref_min_bedrooms != null ? `${l.pref_min_bedrooms}+ bedrooms` : null,
									l.pref_location,
								].filter(Boolean).join(" · ") || l.interested_in}
							</p>
						</div>
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
