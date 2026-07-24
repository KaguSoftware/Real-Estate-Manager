"use client";

import Link from "next/link";
import { useAppStore, useTeamReady } from "@/src/store";
import { listLeads } from "@/src/lib/db/leads";
import { logActivity } from "@/src/lib/db/contactActivity";
import { getMessageTemplate } from "@/src/lib/db/messageTemplates";
import { renderPropertyMessage } from "@/src/lib/whatsappMessage";
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
	const teamReady = useTeamReady();
	const teamName = useAppStore((s) => s.team?.name ?? null);
	const { data } = useCachedResource(
		teamReady ? "leads:all" : null,
		() => listLeads(),
		undefined,
		{ enabled: teamReady },
	);
	// The team's WhatsApp wording; null falls back to the built-in default.
	const { data: template } = useCachedResource(
		teamReady ? "messageTemplate:whatsapp_property" : null,
		() => getMessageTemplate(),
		undefined,
		{ enabled: teamReady },
	);
	if (property.status === "sold") return null;

	const matched = rankLeadsForProperty(data ?? [], property);
	if (matched.length === 0) return null;

	return (
		<Card className="mt-4 sm:mt-5">
			<div className="flex items-center gap-2 mb-4">
				<Users className="w-4 h-4 text-base-content/50" />
				<CardLabel>İlgilenen müşteriler</CardLabel>
				<span className="text-xs text-base-content/50">
					Böyle bir yer arayan {matched.length} müşteri
				</span>
			</div>
			<ul className="divide-y divide-base-300">
				{matched.map(({ lead: l, result }) => (
					<li key={l.id} className="py-2.5 flex items-center gap-3 text-sm">
						<div className="min-w-0 flex-1">
							<Link href="/leads" className="font-medium text-base-content hover:underline">
								{l.full_name}
							</Link>
							<p className="text-xs text-base-content/50 mt-0.5 truncate">
								{result.reasons.join(" · ") || l.interested_in}
							</p>
						</div>
						<span
							className="text-[11px] font-semibold text-success whitespace-nowrap"
							title="Eşleşme gücü, taşınmazın karşıladığı tercih sayısına göre hesaplanır"
						>
							{result.score >= 5 ? "Güçlü eşleşme" : "Eşleşme"}
						</span>
						<Badge tone={LEAD_STATUS_META[l.status].tone}>{LEAD_STATUS_META[l.status].label}</Badge>
						{l.phone && (
							<>
								<span className="text-xs text-base-content/60 whitespace-nowrap hidden sm:inline">{l.phone}</span>
								<WhatsAppButton
									phone={l.phone}
									name={l.full_name}
									// The agent is looking at this lead *because* of this
									// property, so that's the message.
									text={renderPropertyMessage(
										property,
										{ recipientName: l.full_name, senderName: teamName },
										template ?? undefined,
									)}
									onSend={() => {
										// Fire-and-forget: a failed log must not block the share.
										logActivity({
											lead_id: l.id,
											kind: "whatsapp",
											body: `${property.address_line} gönderildi.`,
											property_id: property.id,
										}).catch(() => {});
									}}
								/>
							</>
						)}
					</li>
				))}
			</ul>
		</Card>
	);
}
