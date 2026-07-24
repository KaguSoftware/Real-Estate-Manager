/**
 * Dummy data for the promo. Shapes and labels mirror the real app
 * (src/lib/db/types, src/components/leads/leadStatus.ts) so the footage reads
 * as the actual product, but nothing here touches Supabase.
 */

import type { Tone } from "./theme";

export interface MockProperty {
	title: string;
	location: string;
	price: string;
	status: string;
	tone: Tone;
}

/** Labels from HomeDashboard's PROPERTY_STATUS_LABEL / statusTone. */
export const properties: MockProperty[] = [
	{ title: "Deniz manzaralı 3+1", location: "Kyrenia", price: "9.850.000 TL", status: "Boş", tone: "slate" },
	{ title: "Merkezde 2+1 daire", location: "Lefkoşa", price: "48.000 TL/ay", status: "Kirada", tone: "emerald" },
	{ title: "Bahçeli müstakil ev", location: "Famagusta", price: "14.200.000 TL", status: "Satıldı", tone: "blue" },
	{ title: "Yatırımlık stüdyo", location: "İskele", price: "3.300.000 TL", status: "Boş", tone: "slate" },
	{ title: "Lüks penthouse 4+1", location: "Kyrenia", price: "21.400.000 TL", status: "Kirada", tone: "emerald" },
];

/**
 * The five stages from LEAD_STATUS_ORDER, in pipeline order.
 *
 * "Yeni" starts empty on purpose: newLead (Ayşe Demir) is the lead captured on
 * screen in Scene B and lands in this column, so pre-seeding her here would
 * show her twice.
 */
export const pipeline: { label: string; tone: Tone; leads: string[] }[] = [
	{ label: "Yeni", tone: "slate", leads: [] },
	{ label: "Takip gerekli", tone: "amber", leads: ["Mehmet Yılmaz"] },
	{ label: "İlgileniyor", tone: "indigo", leads: ["Elif Kaya", "Can Öztürk"] },
	{ label: "Arandı – reddetti", tone: "red", leads: [] },
	{ label: "Sonuçlandı", tone: "emerald", leads: ["Zeynep Şahin"] },
];

/**
 * Vertical shows three stages instead of five — at 1080px wide, five columns
 * are ~200px each and unreadable. These three still tell the story: the lead
 * lands in "Yeni", and the board shows movement through to "Sonuçlandı".
 * Index 0 must stay "Yeni" — SceneLead lands the new lead in the first column.
 */
export const pipelineCompact = [pipeline[0], pipeline[2], pipeline[4]];

/** Field values for the LeadForm lookalike — labels match the real form. */
export const newLead = {
	full_name: "Ayşe Demir",
	phone: "+90 533 123 45 67",
	email: "ayse.demir@example.com",
	interested_in: "Deniz manzaralı 3+1",
	pref_location: "Kyrenia",
};

/** Dashboard stat tiles. */
export const stats = [
	{ label: "Taşınmaz", value: "128" },
	{ label: "Aktif müşteri", value: "43" },
	{ label: "Bu ay kapanan", value: "9" },
	{ label: "Portföy değeri", value: "428M TL" },
];
