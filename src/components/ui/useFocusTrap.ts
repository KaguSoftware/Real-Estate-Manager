"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for dialogs/drawers:
 *  - on open, focuses the first focusable element inside the container
 *    (falling back to the container itself),
 *  - keeps Tab cycling inside the container,
 *  - restores focus to the previously focused element on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
	useEffect(() => {
		if (!active) return;
		const container = ref.current;
		if (!container) return;

		const previouslyFocused = document.activeElement as HTMLElement | null;
		const initial = container.querySelector<HTMLElement>(FOCUSABLE);
		(initial ?? container).focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
				(el) => el.offsetParent !== null || el === document.activeElement,
			);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const current = document.activeElement;
			if (e.shiftKey && (current === first || !container.contains(current))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (current === last || !container.contains(current))) {
				e.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			previouslyFocused?.focus?.();
		};
	}, [ref, active]);
}
