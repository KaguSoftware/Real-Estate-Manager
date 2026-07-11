import type { LeadStatus } from "@/src/lib/db/types";
import type { BadgeTone } from "@/src/components/ui";

/** Display labels + badge tone for each lead pipeline status. */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: BadgeTone }> = {
	new:             { label: "Yeni",              tone: "slate" },
	called_rejected: { label: "Arandı – reddetti", tone: "red" },
	follow_up:       { label: "Takip gerekli",     tone: "amber" },
	interested:      { label: "İlgileniyor",       tone: "indigo" },
	closed:          { label: "Sonuçlandı",        tone: "emerald" },
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
	"new", "follow_up", "interested", "called_rejected", "closed",
];
