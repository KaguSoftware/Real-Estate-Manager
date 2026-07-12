"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

interface BulkActionBarProps {
	/** Number of selected rows; the bar renders only when > 0. */
	count: number;
	/** "N seçildi" copy — pass a fully formed label (e.g. "3 taşınmaz seçildi"). */
	label: string;
	onClear: () => void;
	/** Action buttons (Button components) rendered on the right. */
	children?: React.ReactNode;
	className?: string;
}

/**
 * Floating bottom bar for list bulk actions. Appears when at least one row
 * is selected; sits above mobile FABs and respects the safe area.
 */
export function BulkActionBar({ count, label, onClear, children, className }: BulkActionBarProps) {
	if (count <= 0) return null;

	return (
		<div
			role="toolbar"
			aria-label="Toplu işlemler"
			className={cn(
				"fixed left-1/2 -translate-x-1/2 bottom-4 safe-bottom z-40",
				"w-[calc(100%-2rem)] max-w-xl",
				"bg-base-100 border border-base-300 shadow-pop rounded-2xl",
				"px-3 py-2.5 flex items-center gap-2",
				"animate-[bulkBarIn_.18s_ease-out]",
				className,
			)}
		>
			<button
				type="button"
				onClick={onClear}
				aria-label="Seçimi temizle"
				title="Seçimi temizle"
				className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
			>
				<X className="w-4 h-4" />
			</button>
			<p className="text-sm font-semibold text-base-content min-w-0 truncate" aria-live="polite">
				{label}
			</p>
			<div className="ml-auto flex items-center gap-2 shrink-0">{children}</div>
			<style>{`@keyframes bulkBarIn{from{opacity:.4;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
		</div>
	);
}
