"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

interface SheetProps {
	open: boolean;
	onClose: () => void;
	title?: React.ReactNode;
	/** Sticky action bar pinned to the bottom (e.g. Cancel / Save). */
	footer?: React.ReactNode;
	children: React.ReactNode;
	/** Desktop max width. Default keeps forms readable. */
	size?: "md" | "lg";
}

/**
 * Responsive dialog.
 *  - Mobile: full-screen slide-up sheet — sticky header (title + close),
 *    one scrolling body, sticky safe-area-aware footer. No nested scrollers.
 *  - sm+:   centered rounded modal.
 * Closes on backdrop click and Escape.
 */
export function Sheet({ open, onClose, title, footer, children, size = "md" }: SheetProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		// Lock background scroll while the sheet is open.
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, onClose]);

	if (!open) return null;

	const maxW = size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

	return (
		<div
			className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-6 bg-slate-900/40 backdrop-blur-[2px]"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
				className={cn(
					// Mobile: fill the screen. Desktop: centered card.
					"flex flex-col bg-white w-full h-full",
					"sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:shadow-pop",
					"animate-[sheetIn_.18s_ease-out]",
					maxW,
				)}
			>
				{/* Sticky header */}
				<div className="safe-top shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-b border-slate-100">
					<h2 className="text-base font-bold text-slate-900 truncate">{title}</h2>
					<button
						onClick={onClose}
						aria-label="Close"
						className="-mr-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Single scroll region */}
				<div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">{children}</div>

				{/* Sticky footer */}
				{footer && (
					<div className="safe-bottom shrink-0 border-t border-slate-100 px-4 sm:px-6 py-3 bg-white">
						{footer}
					</div>
				)}
			</div>

			<style>{`@keyframes sheetIn{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
		</div>
	);
}
