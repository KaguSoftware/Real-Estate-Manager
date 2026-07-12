import React from "react";
import { cn } from "./cn";

/** Standard surface: cool grey panel, hairline border, soft slate-tinted
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

/** Card section label — quiet sentence-case ink, weight carries hierarchy. */
export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<h2 className={cn("text-sm font-semibold text-base-content/60", className)}>
			{children}
		</h2>
	);
}
