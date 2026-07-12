// Team branding for generated PDFs: agency name, optional logo and a preset
// color palette. Deliberately react-pdf-free so UI code (palette pickers,
// swatches) can import it without pulling @react-pdf/renderer into the bundle.

import { createContext, useContext } from "react";
import { useAppStore } from "@/src/store";
import { getTeamLogoUrl } from "@/src/lib/db/teams";

export interface BrandPalette {
	id: string;
	label: string;
	/** Dominant brand color — sales hero bar, chips, table headers, price box. */
	primary: string;
	/** Darker shade of primary — inner table borders. */
	primaryDark: string;
	/** Secondary accent — deposit box border, currency tags, hero date. */
	accent: string;
	/** Muted companion — card borders, secondary labels. */
	muted: string;
	/** Very light tint of primary — alternating table rows. */
	tint: string;
}

// ── Color math: derive the 5 PDF roles from the 3 user-picked colors ────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Channel-wise lerp: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * Build the full PDF palette from the team's three colors:
 * main → primary (hero bars, table headers), accent1 → accent (chips,
 * currency tags), accent2 → muted (secondary labels, card borders).
 * primaryDark and tint are derived shades of main, matching the ratios of
 * the old hand-tuned presets.
 */
export function paletteFromColors(main: string, accent1: string, accent2: string): BrandPalette {
	return {
		id: "custom",
		label: "Özel",
		primary: main,
		primaryDark: mixHex(main, "#000000", 0.4),
		accent: accent1,
		muted: accent2,
		tint: mixHex(main, "#ffffff", 0.94),
	};
}

/** The app's own brand (graphite + kagu red-orange) — used before a team
 *  loads and as the fallback when a team has no stored colors. */
export const DEFAULT_PALETTE: BrandPalette = {
	id: "kagu", label: "Kagu",
	primary: "#1e242e", primaryDark: "#12161d", accent: "#b74427",
	muted: "#8b929e", tint: "#f2f4f6",
};

export interface PdfBranding {
	/** Agency/team name shown in the footer, signatures and document metadata. */
	teamName: string;
	/** Logo as a data URI (pre-fetched) — react-pdf <Image> renders it reliably. */
	logoDataUrl: string | null;
	palette: BrandPalette;
}

export const DEFAULT_BRANDING: PdfBranding = {
	teamName: "Kagu Real Estate",
	logoDataUrl: null,
	palette: DEFAULT_PALETTE,
};

export const BrandingContext = createContext<PdfBranding>(DEFAULT_BRANDING);
export const useBranding = () => useContext(BrandingContext);

async function fetchAsDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise<string | null>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

/**
 * Build PdfBranding from the signed-in team in the store. The logo is
 * pre-fetched to a data URI so a dead/blocked URL degrades to "no logo"
 * instead of failing the whole PDF render inside react-pdf's <Image>.
 */
export async function getPdfBrandingFromStore(): Promise<PdfBranding> {
	const team = useAppStore.getState().team;
	if (!team) return DEFAULT_BRANDING;
	const logoUrl = getTeamLogoUrl(team.logo_path);
	return {
		teamName: team.name || DEFAULT_BRANDING.teamName,
		logoDataUrl: logoUrl ? await fetchAsDataUrl(logoUrl) : null,
		palette: paletteFromColors(team.brand_color_main, team.brand_color_accent1, team.brand_color_accent2),
	};
}
