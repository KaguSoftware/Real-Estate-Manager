"use client";

import { useEffect } from "react";
import { useAppStore } from "@/src/store";
import { readableOn } from "@/src/lib/pdf/branding";

/**
 * Applies the team's three brand colors to the whole app by overriding the
 * daisyUI theme variables on <html>: main → primary, accent 1 → secondary,
 * accent 2 → accent. Content colors are picked for contrast, and everything
 * is removed again on sign-out so the stock Kagu theme returns.
 */
export function BrandTheme() {
	const main = useAppStore((s) => s.team?.brand_color_main);
	const accent1 = useAppStore((s) => s.team?.brand_color_accent1);
	const accent2 = useAppStore((s) => s.team?.brand_color_accent2);

	useEffect(() => {
		const root = document.documentElement.style;
		const vars: [string, string | undefined][] = [
			["--color-primary", main],
			["--color-primary-content", main ? readableOn(main) : undefined],
			["--color-secondary", accent1],
			["--color-secondary-content", accent1 ? readableOn(accent1) : undefined],
			["--color-accent", accent2],
			["--color-accent-content", accent2 ? readableOn(accent2) : undefined],
		];
		for (const [name, value] of vars) {
			if (value) root.setProperty(name, value);
			else root.removeProperty(name);
		}
		return () => {
			for (const [name] of vars) root.removeProperty(name);
		};
	}, [main, accent1, accent2]);

	return null;
}
