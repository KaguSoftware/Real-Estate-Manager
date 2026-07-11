"use client";

/**
 * ThemeToggle — light / dark / system, persisted in localStorage("kagu-theme").
 * "system" removes the data-theme attribute so the CSS defaults apply (estate
 * for light, estate-dark via prefersdark for dark) — that path needs no JS at
 * paint time. Explicit choices are applied before hydration by the inline
 * script in the root layout, so there is never a flash.
 */

import { useState, useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "./cn";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "kagu-theme";

export function applyTheme(pref: ThemePref) {
	const root = document.documentElement;
	if (pref === "light") root.setAttribute("data-theme", "estate");
	else if (pref === "dark") root.setAttribute("data-theme", "estate-dark");
	else root.removeAttribute("data-theme");
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
	{ value: "light", label: "Açık", Icon: Sun },
	{ value: "dark", label: "Koyu", Icon: Moon },
	{ value: "system", label: "Sistem", Icon: Monitor },
];

const emptySubscribe = () => () => {};
function readStoredPref(): ThemePref {
	const s = localStorage.getItem(STORAGE_KEY);
	return s === "light" || s === "dark" ? s : "system";
}

export function ThemeToggle({ className }: { className?: string }) {
	// Server snapshot renders "system"; the client snapshot supplies the stored
	// choice right after hydration (the visual theme itself is already correct
	// pre-hydration via the boot script in the root layout). Picks made in this
	// session live in local state layered over the stored value.
	const stored = useSyncExternalStore(emptySubscribe, readStoredPref, () => "system" as ThemePref);
	const [override, setOverride] = useState<ThemePref | null>(null);
	const pref = override ?? stored;

	function onPick(next: ThemePref) {
		setOverride(next);
		if (next === "system") localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, next);
		applyTheme(next);
	}

	return (
		<div
			role="radiogroup"
			aria-label="Tema"
			className={cn("flex rounded-xl border border-base-300 bg-base-200 p-0.5", className)}
		>
			{OPTIONS.map(({ value, label, Icon }) => (
				<button
					key={value}
					type="button"
					role="radio"
					aria-checked={pref === value}
					title={label}
					onClick={() => onPick(value)}
					className={cn(
						"flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-colors min-h-9",
						pref === value
							? "bg-base-100 text-base-content shadow-soft"
							: "text-base-content/60 hover:text-base-content",
					)}
				>
					<Icon className="w-3.5 h-3.5" />
					{label}
				</button>
			))}
		</div>
	);
}
