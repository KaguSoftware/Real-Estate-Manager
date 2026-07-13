"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { useFocusTrap } from "./useFocusTrap";

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
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	useFocusTrap(panelRef, open);

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

	// Portal to <body>: ancestors with backdrop-filter/transform (e.g. the
	// sticky app header) create a containing block that traps fixed elements.
	return createPortal(
		<div
			className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-6 bg-black/40 backdrop-blur-[2px]"
			onClick={onClose}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? titleId : undefined}
				tabIndex={-1}
				onClick={(e) => e.stopPropagation()}
				className={cn(
					// Mobile: fill the screen. Desktop: centered card.
					"flex flex-col bg-base-100 w-full h-full overflow-hidden",
					"sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:shadow-pop",
					"animate-[sheetIn_.18s_ease-out]",
					maxW,
				)}
			>
				{/* Sticky header */}
				<div className="safe-top shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-b border-base-300">
					<h2 id={titleId} className="text-base font-bold text-base-content truncate">{title}</h2>
					<button
						onClick={onClose}
						aria-label="Kapat"
						className="-mr-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Single scroll region */}
				<div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">{children}</div>

				{/* Sticky footer */}
				{footer && (
					<div className="shrink-0 border-t border-base-300 px-4 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-base-100">
						{footer}
					</div>
				)}
			</div>

			<style>{`@keyframes sheetIn{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
		</div>,
		document.body,
	);
}
