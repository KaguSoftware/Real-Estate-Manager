"use client";

import { motion } from "motion/react";
import { cn } from "@/src/components/ui/cn";

const SHEETS = [0, 1, 2];

const SIZES = {
	sm: { wrap: "h-5 w-6", sheet: "h-3 w-5 rounded-[2px]", step: 2 },
	lg: { wrap: "h-16 w-20", sheet: "h-9 w-16 rounded-[3px]", step: 7 },
};

/** Loading indicator: a small stack of paper sheets jiggling as they settle. */
export function PaperPileLoader({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
	const { wrap, sheet, step } = SIZES[size];
	return (
		<span className={cn("relative inline-flex items-center justify-center", wrap, className)} aria-hidden>
			{SHEETS.map((i) => (
				<motion.span
					key={i}
					className={cn("absolute border border-base-300 bg-base-100 shadow-soft", sheet)}
					style={{ bottom: i * step }}
					animate={{ y: [0, -(step - 0.5), 0], rotate: [0, i % 2 === 0 ? -6 : 6, 0] }}
					transition={{
						duration: 0.9,
						repeat: Infinity,
						ease: "easeInOut",
						delay: i * 0.15,
					}}
				/>
			))}
		</span>
	);
}
