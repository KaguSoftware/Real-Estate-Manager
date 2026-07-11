import React from "react";
import { cn } from "./cn";

/** Standard surface: rounded, soft shadow, hairline border, white background.
 *  `padded` (default) applies comfortable interior padding. */
export function Card({
	className,
	padded = true,
	children,
	...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
	return (
		<div
			className={cn(
				"bg-base-100 rounded-2xl border border-base-300/80 shadow-card",
				padded && "p-5 sm:p-6",
				className,
			)}
			{...rest}
		>
			{children}
		</div>
	);
}

/** Section eyebrow used inside cards — replaces the old text-[10px] headers. */
export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<h2 className={cn("text-xs font-bold uppercase tracking-wider text-base-content/60", className)}>
			{children}
		</h2>
	);
}
