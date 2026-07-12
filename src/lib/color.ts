// Small color math for the app-side brand accent (items: invisible UI with
// dark brand colors, dark-mode icon colors). PDF palette math stays in
// src/lib/pdf/branding.ts — this module is for on-screen contrast safety.

export function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
	return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Channel-wise lerp: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** White or near-black — whichever reads better on the given background. */
export function readableOn(hex: string): string {
	return luminance(hex) > 0.35 ? "#1a1f27" : "#ffffff";
}

// Approximate daisyUI base-100 surfaces of the two app themes (globals.css).
const LIGHT_BASE = "#faf8f5";
const DARK_BASE = "#1b202a";

/**
 * Derive a UI-safe accent from a brand color for the given theme: nudge it
 * toward white (dark theme) or black (light theme) until it clears a 3:1
 * contrast ratio against the theme's surface — the WCAG minimum for UI
 * components — so brand-tinted buttons, links and icons never vanish.
 */
export function deriveUiAccent(brandHex: string, theme: "light" | "dark"): string {
	const base = theme === "dark" ? DARK_BASE : LIGHT_BASE;
	const towards = theme === "dark" ? "#ffffff" : "#000000";
	let out = brandHex;
	for (let i = 0; i < 24 && contrastRatio(out, base) < 3; i++) {
		out = mixHex(out, towards, 0.08);
	}
	return out;
}
