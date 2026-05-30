"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "md" | "sm" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
	primary:
		"bg-primary text-primary-content hover:brightness-110 active:brightness-95 shadow-soft",
	secondary:
		"bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-900 shadow-soft",
	ghost:
		"bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
	outline:
		"bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-soft",
	danger:
		"bg-white text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100",
};

const SIZES: Record<Size, string> = {
	// 44px min height across the board for comfortable touch.
	md: "h-11 px-4 text-sm gap-2",
	sm: "h-9 px-3 text-sm gap-1.5",
	lg: "h-12 px-6 text-base gap-2",
	icon: "h-11 w-11 p-0",
};

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	/** Render full-width (common on mobile / sticky action bars). */
	block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest },
		ref,
	) {
		return (
			<button
				ref={ref}
				disabled={disabled || loading}
				className={cn(
					"inline-flex items-center justify-center font-semibold rounded-xl whitespace-nowrap select-none",
					"transition-[filter,background-color,color] duration-150",
					"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
					"disabled:opacity-50 disabled:pointer-events-none",
					VARIANTS[variant],
					SIZES[size],
					block && "w-full",
					className,
				)}
				{...rest}
			>
				{loading && <Loader2 className="w-4 h-4 animate-spin" />}
				{children}
			</button>
		);
	},
);
