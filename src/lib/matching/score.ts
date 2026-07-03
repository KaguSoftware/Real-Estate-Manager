// Lead ↔ property match scoring. Extracted from the boolean matcher that
// lived in MatchingLeads.tsx so both directions (clients for a property,
// properties for a client) share one unit-tested implementation.

import type { Lead, Property } from "@/src/lib/db/types";

export const MATCH_ACTIVE_STATUSES: Lead["status"][] = ["new", "follow_up", "interested"];

export interface MatchResult {
	/** 0 means no match. Higher is better; max is currently 9. */
	score: number;
	/** Human-readable reasons behind the score, e.g. "3+1", "3+ bedrooms". */
	reasons: string[];
}

const NO_MATCH: MatchResult = { score: 0, reasons: [] };

/**
 * Score how well a lead's stated preferences fit a property.
 * Hard requirements (any stated preference that conflicts) zero the score.
 * Leads with no preferences at all score 0 — matching everyone is matching
 * no one. Only active-pipeline leads are considered.
 */
export function scoreLeadProperty(lead: Lead, p: Property): MatchResult {
	if (!MATCH_ACTIVE_STATUSES.includes(lead.status)) return NO_MATCH;
	const hasAnyPref =
		lead.pref_listing_type || lead.pref_nitelik ||
		lead.pref_min_bedrooms != null || lead.pref_location;
	if (!hasAnyPref) return NO_MATCH;

	let score = 0;
	const reasons: string[] = [];

	if (lead.pref_listing_type) {
		if (lead.pref_listing_type !== p.listing_type) return NO_MATCH;
		reasons.push(lead.pref_listing_type === "for_rent" ? "renting" : "buying");
		score += 2;
	}

	if (lead.pref_nitelik) {
		if (!p.nitelik) return NO_MATCH;
		if (lead.pref_nitelik === p.nitelik) {
			score += 3;
			reasons.push(p.nitelik);
		} else {
			const want = lead.pref_nitelik.toLocaleLowerCase("tr-TR");
			const have = p.nitelik.toLocaleLowerCase("tr-TR");
			if (!have.includes(want) && !want.includes(have)) return NO_MATCH;
			score += 2;
			reasons.push(`~${p.nitelik}`);
		}
	}

	if (lead.pref_min_bedrooms != null) {
		if (p.bedrooms == null || p.bedrooms < lead.pref_min_bedrooms) return NO_MATCH;
		score += 2;
		reasons.push(`${lead.pref_min_bedrooms}+ bedrooms`);
	}

	if (lead.pref_location) {
		const haystack = [p.city, p.mahalle, p.mevkii, p.address_line]
			.filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
		if (!haystack.includes(lead.pref_location.toLocaleLowerCase("tr-TR"))) return NO_MATCH;
		score += 2;
		reasons.push(lead.pref_location);
	}

	return { score, reasons };
}

/** Leads matching a property, best first. */
export function rankLeadsForProperty(
	leads: Lead[],
	property: Property,
): { lead: Lead; result: MatchResult }[] {
	return leads
		.map((lead) => ({ lead, result: scoreLeadProperty(lead, property) }))
		.filter((m) => m.result.score > 0)
		.sort((a, b) => b.result.score - a.result.score);
}

/** Properties matching a lead, best first. */
export function rankPropertiesForLead(
	lead: Lead,
	properties: Property[],
): { property: Property; result: MatchResult }[] {
	return properties
		.map((property) => ({ property, result: scoreLeadProperty(lead, property) }))
		.filter((m) => m.result.score > 0)
		.sort((a, b) => b.result.score - a.result.score);
}
