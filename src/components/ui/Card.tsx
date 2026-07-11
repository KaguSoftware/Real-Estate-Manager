import React from "react";
import { cn } from "./cn";

/** Standard surface: warm charcoal/ivory panel, hairline border, deep soft
 *  shadow, generous interior padding (`padded`, default on). */
export function Card({
	className,
	padded = true,
	children,
	...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
	return (
		<div
			className={cn(
				"bg-base-100 rounded-2xl border border-base-300/70 shadow-card",
				padded && "p-6 sm:p-8",
				className,
			)}
			{...rest}
		>
			{children}
		</div>
	);
}

/** Section eyebrow used inside cards — gold, spaced small caps. */
export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<h2 className={cn("text-[11px] font-bold uppercase tracking-[0.18em] text-primary/90", className)}>
			{children}
		</h2>
	);
}
