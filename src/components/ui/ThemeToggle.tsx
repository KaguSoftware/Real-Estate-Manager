"use client";

/**
 * ThemeToggle — light (default) / dark, persisted in
 * localStorage("kagu-theme"). Light needs no attribute; dark is an explicit
 * data-theme="estate-dark". An inline boot script in the root layout applies
 * the stored choice before hydration, so there is never a flash.
 */

import { useState, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "./cn";

export type ThemePref = "dark" | "light";

const STORAGE_KEY = "kagu-theme";

export function applyTheme(pref: ThemePref) {
	const root = document.documentElement;
	if (pref === "dark") root.setAttribute("data-theme", "estate-dark");
	else root.removeAttribute("data-theme");
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
	{ value: "light", label: "Açık", Icon: Sun },
	{ value: "dark", label: "Koyu", Icon: Moon },
];

const emptySubscribe = () => () => {};
function readStoredPref(): ThemePref {
	return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

/** Shared light/dark state hook: stored pref layered with a session override. */
function useThemePref(): [ThemePref, (next: ThemePref) => void] {
	// Server snapshot renders "light" (the default); the client snapshot
	// supplies the stored choice right after hydration (the visual theme is
	// already correct pre-hydration via the boot script). Picks made in this
	// session live in local state layered over the stored value.
	const stored = useSyncExternalStore(emptySubscribe, readStoredPref, () => "light" as ThemePref);
	const [override, setOverride] = useState<ThemePref | null>(null);
	const pref = override ?? stored;

	function onPick(next: ThemePref) {
		setOverride(next);
		if (next === "dark") localStorage.setItem(STORAGE_KEY, "dark");
		else localStorage.removeItem(STORAGE_KEY);
		applyTheme(next);
	}

	return [pref, onPick];
}

/**
 * ThemeToggleButton — compact single icon button that flips light↔dark.
 * Sized for tight spots (e.g. next to the sidebar workspace name). Shows the
 * icon of the theme you'd switch *to*, like most app theme switches.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
	const [pref, onPick] = useThemePref();
	const next: ThemePref = pref === "dark" ? "light" : "dark";
	const Icon = next === "dark" ? Moon : Sun;

	return (
		<button
			type="button"
			onClick={() => onPick(next)}
			aria-label={next === "dark" ? "Koyu temaya geç" : "Açık temaya geç"}
			title={next === "dark" ? "Koyu tema" : "Açık tema"}
			className={cn(
				"group shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors",
				className,
			)}
		>
			<Icon
				key={pref}
				className="w-4 h-4 animate-theme-swap transition-transform duration-200 group-hover:scale-110 motion-reduce:animate-none"
			/>
		</button>
	);
}

export function ThemeToggle({ className }: { className?: string }) {
	const [pref, onPick] = useThemePref();

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
