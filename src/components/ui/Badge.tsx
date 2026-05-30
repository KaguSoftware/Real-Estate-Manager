import React from "react";
import { cn } from "./cn";

export type BadgeTone =
	| "slate" | "indigo" | "amber" | "emerald" | "blue" | "red" | "violet";

const TONES: Record<BadgeTone, string> = {
	slate:   "bg-slate-100 text-slate-600 border-slate-200",
	indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
	amber:   "bg-amber-50 text-amber-700 border-amber-200",
	emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
	blue:    "bg-blue-50 text-blue-700 border-blue-200",
	red:     "bg-red-50 text-red-700 border-red-200",
	violet:  "bg-violet-50 text-violet-700 border-violet-200",
};

/** Status / type pill. text-xs floor (no more 10px), comfortable padding. */
export function Badge({
	tone = "slate",
	className,
	children,
}: {
	tone?: BadgeTone;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border",
				TONES[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}
