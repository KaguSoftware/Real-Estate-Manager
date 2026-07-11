"use client";

/**
 * ThemeToggle — dark (default, signature look) / light, persisted in
 * localStorage("kagu-theme"). Dark needs no attribute; light is an explicit
 * data-theme="estate". An inline boot script in the root layout applies the
 * stored choice before hydration, so there is never a flash.
 */

import { useState, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "./cn";

export type ThemePref = "dark" | "light";

const STORAGE_KEY = "kagu-theme";

export function applyTheme(pref: ThemePref) {
	const root = document.documentElement;
	if (pref === "light") root.setAttribute("data-theme", "estate");
	else root.removeAttribute("data-theme");
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
	{ value: "dark", label: "Koyu", Icon: Moon },
	{ value: "light", label: "Açık", Icon: Sun },
];

const emptySubscribe = () => () => {};
function readStoredPref(): ThemePref {
	return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function ThemeToggle({ className }: { className?: string }) {
	// Server snapshot renders "dark" (the default); the client snapshot
	// supplies the stored choice right after hydration (the visual theme is
	// already correct pre-hydration via the boot script). Picks made in this
	// session live in local state layered over the stored value.
	const stored = useSyncExternalStore(emptySubscribe, readStoredPref, () => "dark" as ThemePref);
	const [override, setOverride] = useState<ThemePref | null>(null);
	const pref = override ?? stored;

	function onPick(next: ThemePref) {
		setOverride(next);
		if (next === "light") localStorage.setItem(STORAGE_KEY, "light");
		else localStorage.removeItem(STORAGE_KEY);
		applyTheme(next);
	}

	return (
		<div
			role="radiogroup"
			aria-label="Tema"
			className={cn("flex rounded-lg border border-base-300 bg-base-200 p-0.5", className)}
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
						"flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors min-h-9",
						pref === value
							? "bg-base-100 text-primary shadow-soft"
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
