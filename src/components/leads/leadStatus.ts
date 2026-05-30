import type { LeadStatus } from "@/src/lib/db/types";
import type { BadgeTone } from "@/src/components/ui";

/** Display labels + badge tone for each lead pipeline status. */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: BadgeTone }> = {
	new:             { label: "New",               tone: "slate" },
	called_rejected: { label: "Called – rejected", tone: "red" },
	follow_up:       { label: "Follow-up needed",  tone: "amber" },
	interested:      { label: "Interested",        tone: "indigo" },
	closed:          { label: "Closed",            tone: "emerald" },
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
	"new", "follow_up", "interested", "called_rejected", "closed",
];
