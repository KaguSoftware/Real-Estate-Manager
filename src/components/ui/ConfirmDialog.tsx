"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	/** Supporting copy. Spell out consequences ("This cannot be undone."). */
	message?: React.ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: "danger" | "primary";
	/** Disables both buttons and shows a spinner while the action runs. */
	loading?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * Centered confirmation modal — replaces native confirm().
 * Escape / backdrop click cancel; initial focus lands on Cancel so a stray
 * Enter never destroys anything.
 */
export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "Onayla",
	cancelLabel = "Vazgeç",
	tone = "danger",
	loading,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const previouslyFocused = document.activeElement as HTMLElement | null;
		cancelRef.current?.focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !loading) onCancel();
			if (e.key === "Tab") {
				// Two-button trap: cycle focus within the panel.
				const focusables = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
				if (!focusables || focusables.length === 0) return;
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			previouslyFocused?.focus?.();
		};
	}, [open, loading, onCancel]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
			onClick={() => { if (!loading) onCancel(); }}
		>
			<div
				ref={panelRef}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm bg-base-100 rounded-2xl shadow-pop p-5 sm:p-6 animate-[sheetIn_.18s_ease-out]"
			>
				<div className="flex items-start gap-3">
					<div
						className={cn(
							"shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
							tone === "danger" ? "bg-error/10 text-error" : "bg-primary/10 text-primary",
						)}
					>
						<AlertTriangle className="w-5 h-5" />
					</div>
					<div className="min-w-0">
						<h2 id="confirm-dialog-title" className="text-base font-bold text-base-content">
							{title}
						</h2>
						{message && <div className="mt-1 text-sm text-base-content/60">{message}</div>}
					</div>
				</div>

				<div className="mt-5 flex gap-2 justify-end">
					<Button ref={cancelRef} type="button" variant="ghost" onClick={onCancel} disabled={loading}>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={tone === "danger" ? "danger" : "primary"}
						loading={loading}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>

				<style>{`@keyframes sheetIn{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
			</div>
		</div>
	);
}
