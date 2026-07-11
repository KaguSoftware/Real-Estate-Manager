import React from "react";
import { cn } from "./cn";

export type BadgeTone =
	| "slate" | "indigo" | "amber" | "emerald" | "blue" | "red" | "violet";

const TONES: Record<BadgeTone, string> = {
	slate:   "bg-base-200 text-base-content/70 border-base-300",
	indigo:  "bg-primary/10 text-primary border-primary/30",
	amber:   "bg-warning/10 text-warning border-warning/30",
	emerald: "bg-success/10 text-success border-success/30",
	blue:    "bg-info/10 text-info border-info/30",
	red:     "bg-error/10 text-error border-error/40",
	violet:  "bg-violet-500/10 text-violet-500 border-violet-500/30",
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
