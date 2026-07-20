"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "./cn";
import { inputClass } from "./FormField";
import { foldTr } from "@/src/lib/turkeyGeo";
import { Check, ChevronDown } from "lucide-react";

interface ComboboxProps {
	value: string;
	onChange: (value: string) => void;
	/** Suggestions, not a whitelist — any typed value is accepted. */
	options: string[];
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	/** Cap on rendered suggestions; keeps long lists cheap. */
	maxVisible?: number;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
}

/**
 * Free-text input with a filtered suggestion list — a real combobox, not a
 * select. Typing filters; picking fills; anything typed is still accepted.
 *
 * Deliberately permissive: existing property/project rows already hold
 * arbitrary city strings, and villages or site names are legitimate values a
 * fixed list would reject. Matching is Turkish-aware via foldTr, so "izmir"
 * finds "İzmir".
 */
export function Combobox({
	value,
	onChange,
	options,
	placeholder,
	disabled,
	id,
	className,
	maxVisible = 8,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
	"aria-label": ariaLabel,
}: ComboboxProps) {
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(-1);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);
	const listboxId = useId();

	const matches = useMemo(() => {
		const q = foldTr(value);
		// An exact hit means the user already picked it — show the full list so
		// they can still switch, rather than a single redundant row.
		const pool = !q
			? options
			: options.filter((o) => foldTr(o).includes(q));
		return pool.slice(0, maxVisible);
	}, [options, value, maxVisible]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	useEffect(() => {
		if (!open || highlighted < 0) return;
		listRef.current
			?.querySelector(`[data-index="${highlighted}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [open, highlighted]);

	function commit(option: string) {
		onChange(option);
		setOpen(false);
		setHighlighted(-1);
		inputRef.current?.focus();
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (!open) { setOpen(true); setHighlighted(0); }
				else setHighlighted((h) => Math.min(h + 1, matches.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlighted((h) => Math.max(h - 1, 0));
				break;
			case "Enter":
				// Only steal Enter when a suggestion is actively highlighted —
				// otherwise the surrounding form should submit as normal.
				if (open && highlighted >= 0 && matches[highlighted]) {
					e.preventDefault();
					commit(matches[highlighted]);
				}
				break;
			case "Escape":
				if (open) { e.preventDefault(); setOpen(false); setHighlighted(-1); }
				break;
			case "Tab":
				setOpen(false);
				break;
		}
	}

	return (
		<div ref={rootRef} className={cn("relative w-full", className)}>
			<div className="relative">
				<input
					ref={inputRef}
					type="text"
					role="combobox"
					autoComplete="off"
					id={id}
					disabled={disabled}
					value={value}
					placeholder={placeholder}
					onChange={(e) => {
						onChange(e.target.value);
						setOpen(true);
						setHighlighted(-1);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
					aria-expanded={open}
					aria-controls={open ? listboxId : undefined}
					aria-autocomplete="list"
					aria-activedescendant={
						open && highlighted >= 0 ? `${listboxId}-${highlighted}` : undefined
					}
					aria-invalid={ariaInvalid}
					aria-describedby={ariaDescribedBy}
					aria-label={ariaLabel}
					className={cn(inputClass, "pr-10")}
				/>
				<button
					type="button"
					tabIndex={-1}
					disabled={disabled}
					aria-label={open ? "Listeyi kapat" : "Listeyi aç"}
					onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
					className="absolute right-0 top-0 h-12 w-10 inline-flex items-center justify-center text-base-content/50 hover:text-base-content/80 transition-colors"
				>
					<ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
				</button>
			</div>

			{open && matches.length > 0 && (
				<div
					ref={listRef}
					id={listboxId}
					role="listbox"
					// Right-anchored and viewport-capped for the same reason as
					// Dropdown: a menu must never widen its container.
					className="absolute right-0 z-40 mt-1.5 min-w-full w-max max-w-[min(18rem,calc(100vw-2rem))] max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border border-base-300 bg-base-100 shadow-pop p-1 animate-dropdown-in"
				>
					{matches.map((opt, i) => {
						const isSelected = opt === value;
						return (
							<button
								key={opt}
								type="button"
								role="option"
								id={`${listboxId}-${i}`}
								data-index={i}
								aria-selected={isSelected}
								onMouseEnter={() => setHighlighted(i)}
								onClick={() => commit(opt)}
								className={cn(
									"w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors",
									i === highlighted ? "bg-base-200" : "hover:bg-base-200/60",
								)}
							>
								<span className="truncate">{opt}</span>
								{isSelected && <Check className="w-4 h-4 shrink-0 text-primary" strokeWidth={2.5} />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
