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
		"bg-neutral text-neutral-content hover:bg-neutral/90 active:bg-neutral shadow-soft",
	ghost:
		"bg-transparent text-base-content/80 hover:bg-base-200 active:bg-base-300",
	outline:
		"bg-base-100 text-base-content/80 border border-base-300 hover:bg-base-200 active:bg-base-300 shadow-soft",
	danger:
		"bg-base-100 text-error border border-error/40 hover:bg-error/10 active:bg-error/20",
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
					"inline-flex items-center justify-center font-semibold tracking-wide rounded-lg whitespace-nowrap select-none",
					"transition-[filter,background-color,color,box-shadow] duration-150",
					"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
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
