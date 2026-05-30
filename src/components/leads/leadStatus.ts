import type { LeadStatus } from "@/src/lib/db/types";

/** Display labels + badge color classes for each lead pipeline status. */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; badge: string }> = {
	new:             { label: "New",             badge: "bg-slate-100 text-slate-600 border-slate-200" },
	called_rejected: { label: "Called – rejected", badge: "bg-red-50 text-red-700 border-red-200" },
	follow_up:       { label: "Follow-up needed", badge: "bg-amber-50 text-amber-700 border-amber-200" },
	interested:      { label: "Interested",      badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
	closed:          { label: "Closed",          badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
	"new", "follow_up", "interested", "called_rejected", "closed",
];
