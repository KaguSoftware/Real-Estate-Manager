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

// `kagu` matches the app's brand (graphite + kagu red-orange) and is the
// default; `avera` mirrors the historical hardcoded palette in styles.ts so
// existing documents can be reproduced.
export const BRAND_PALETTES: Record<string, BrandPalette> = {
	kagu: {
		id: "kagu", label: "Kagu",
		primary: "#1e242e", primaryDark: "#12161d", accent: "#b74427",
		muted: "#8b929e", tint: "#f2f4f6",
	},
	slate: {
		id: "slate", label: "Slate",
		primary: "#0f172a", primaryDark: "#020617", accent: "#6366f1",
		muted: "#94a3b8", tint: "#f1f5f9",
	},
	avera: {
		id: "avera", label: "Navy & Red",
		primary: "#051526", primaryDark: "#020a13", accent: "#B11211",
		muted: "#9D9F9E", tint: "#e8ebef",
	},
	emerald: {
		id: "emerald", label: "Emerald",
		primary: "#064e3b", primaryDark: "#022c22", accent: "#f59e0b",
		muted: "#6ee7b7", tint: "#ecfdf5",
	},
	indigo: {
		id: "indigo", label: "Indigo",
		primary: "#312e81", primaryDark: "#1e1b4b", accent: "#e11d48",
		muted: "#a5b4fc", tint: "#eef2ff",
	},
	burgundy: {
		id: "burgundy", label: "Burgundy",
		primary: "#5c0a1e", primaryDark: "#3b0413", accent: "#b45309",
		muted: "#d4a5b0", tint: "#fdf2f5",
	},
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
	palette: BRAND_PALETTES.kagu,
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
		palette: BRAND_PALETTES[team.brand_palette] ?? BRAND_PALETTES.kagu,
	};
}
