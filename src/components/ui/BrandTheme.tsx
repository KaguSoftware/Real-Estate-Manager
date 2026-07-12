"use client";

import { useEffect } from "react";
import { useAppStore } from "@/src/store";
import { deriveUiAccent, readableOn } from "@/src/lib/color";

// Persisted, theme-resolved brand vars; read by the pre-paint boot script in
// layout.tsx so a hard refresh paints the team's accent immediately instead of
// flashing the stock palette first. Shape:
//   { light: { p, pc }, dark: { p, pc } }
export const BRAND_VARS_STORAGE_KEY = "kagu-brand-vars";

function currentTheme(): "light" | "dark" {
	return document.documentElement.getAttribute("data-theme") === "estate-dark" ? "dark" : "light";
}

/**
 * Applies the team's brand color to the app UI — safely.
 *
 * The three stored brand colors are designed for PDF documents (see
 * src/lib/pdf/branding.ts) and are often very dark; using them verbatim as the
 * daisyUI palette made buttons/icons invisible. So the app takes ONLY a single
 * accent, derived from brand_color_main and contrast-adjusted per theme
 * (--color-primary + content). secondary/accent stay stock. Documents keep the
 * exact colors the team picked.
 */
export function BrandTheme() {
	const main = useAppStore((s) => s.team?.brand_color_main);

	useEffect(() => {
		const root = document.documentElement;

		const apply = () => {
			if (!main) {
				root.style.removeProperty("--color-primary");
				root.style.removeProperty("--color-primary-content");
				try { localStorage.removeItem(BRAND_VARS_STORAGE_KEY); } catch {}
				return;
			}
			const light = deriveUiAccent(main, "light");
			const dark = deriveUiAccent(main, "dark");
			const vars = {
				light: { p: light, pc: readableOn(light) },
				dark: { p: dark, pc: readableOn(dark) },
			};
			const active = vars[currentTheme()];
			root.style.setProperty("--color-primary", active.p);
			root.style.setProperty("--color-primary-content", active.pc);
			try { localStorage.setItem(BRAND_VARS_STORAGE_KEY, JSON.stringify(vars)); } catch {}
		};

		apply();

		// Re-resolve when the user toggles light/dark (ThemeToggle flips the
		// data-theme attribute) — the safe accent differs per theme.
		const observer = new MutationObserver(apply);
		observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

		return () => {
			observer.disconnect();
			root.style.removeProperty("--color-primary");
			root.style.removeProperty("--color-primary-content");
		};
	}, [main]);

	return null;
}
