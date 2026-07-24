"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "./cn";
import { inputClass } from "./FormField";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
	/** ISO date, "yyyy-mm-dd". "" = empty. Matches what the db layer stores. */
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	/** Inclusive ISO bounds; days outside them are unselectable. */
	min?: string;
	max?: string;
	id?: string;
	className?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
}

const MONTHS = [
	"Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
	"Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
// Turkish weeks start on Monday.
const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Parse "yyyy-mm-dd" without touching the Date constructor's timezone rules —
 *  `new Date("2026-07-20")` is UTC midnight and can render as the 19th. */
function parseISO(iso: string): { y: number; m: number; d: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
	if (!match) return null;
	const y = Number(match[1]);
	const m = Number(match[2]) - 1;
	const d = Number(match[3]);
	if (m < 0 || m > 11 || d < 1 || d > 31) return null;
	// Round-trip through a local Date to reject the 31st of a 30-day month.
	const probe = new Date(y, m, d);
	if (probe.getFullYear() !== y || probe.getMonth() !== m || probe.getDate() !== d) return null;
	return { y, m, d };
}

function formatTr(iso: string): string {
	const p = parseISO(iso);
	return p ? `${pad(p.d)}.${pad(p.m + 1)}.${p.y}` : "";
}

function daysInMonth(y: number, m: number): number {
	return new Date(y, m + 1, 0).getDate();
}

/** Monday-first offset of the 1st of the month (0 = Monday … 6 = Sunday). */
function leadingBlanks(y: number, m: number): number {
	return (new Date(y, m, 1).getDay() + 6) % 7;
}

/**
 * Custom date picker replacing the native <input type="date">, whose control is
 * rendered by the browser/OS and cannot be themed — it showed a light-on-light
 * "dd----yyyy" against the dark theme and ignored the app's field skin.
 *
 * Stores ISO "yyyy-mm-dd" (unchanged from the native input, so callers and the
 * db layer need no adjustment) and displays Turkish gg.aa.yyyy.
 */
export function DatePicker({
	value,
	onChange,
	placeholder = "gg.aa.yyyy",
	disabled,
	required,
	min,
	max,
	id,
	className,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
	"aria-label": ariaLabel,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const gridId = useId();

	const selected = useMemo(() => parseISO(value), [value]);

	// Which month the grid is showing. Follows the selection when it changes
	// externally; otherwise defaults to today.
	const [view, setView] = useState(() => {
		const base = selected ?? todayParts();
		return { y: base.y, m: base.m };
	});
	// Render-phase sync (not an effect): when `value` moves to a different month
	// than the one on screen, re-seed the view. Same pattern as NumberInput's
	// external-reset handling — an effect here would cascade an extra render.
	const [prevValue, setPrevValue] = useState(value);
	if (prevValue !== value) {
		setPrevValue(value);
		if (selected && (selected.y !== view.y || selected.m !== view.m)) {
			setView({ y: selected.y, m: selected.m });
		}
	}

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	const today = todayParts();
	const total = daysInMonth(view.y, view.m);
	const blanks = leadingBlanks(view.y, view.m);

	function isOutOfRange(iso: string): boolean {
		if (min && iso < min) return true;
		if (max && iso > max) return true;
		return false;
	}

	function commit(day: number) {
		const iso = toISO(view.y, view.m, day);
		if (isOutOfRange(iso)) return;
		onChange(iso);
		setOpen(false);
		triggerRef.current?.focus();
	}

	function shiftMonth(delta: number) {
		setView((v) => {
			const next = new Date(v.y, v.m + delta, 1);
			return { y: next.getFullYear(), m: next.getMonth() };
		});
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape" && open) {
			e.preventDefault();
			setOpen(false);
			triggerRef.current?.focus();
		} else if ((e.key === "Enter" || e.key === " ") && !open) {
			e.preventDefault();
			setOpen(true);
		}
	}

	const label = formatTr(value);

	return (
		<div ref={rootRef} className={cn("relative w-full", className)}>
			<button
				ref={triggerRef}
				type="button"
				id={id}
				disabled={disabled}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={onKeyDown}
				// combobox (like Dropdown) rather than a bare button: it owns a popup
				// and reports a value, so aria-invalid/aria-expanded are meaningful
				// here — on an implicit button role they would be ignored.
				role="combobox"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? gridId : undefined}
				aria-invalid={ariaInvalid}
				aria-describedby={ariaDescribedBy}
				aria-label={ariaLabel}
				className={cn(
					inputClass,
					"flex items-center justify-between gap-2 text-left",
					open && "border-primary ring-4 ring-primary/15",
					!label && "text-base-content/40",
					ariaInvalid && "border-error/40 focus:border-error/60 focus:ring-error/15",
				)}
			>
				<span className="truncate">{label || placeholder}</span>
				<span className="flex items-center gap-1 shrink-0">
					{label && !required && !disabled && (
						// Clearing is the only way back to "no date" once one is picked.
						<span
							role="button"
							tabIndex={-1}
							aria-label="Tarihi temizle"
							onClick={(e) => {
								e.stopPropagation();
								onChange("");
							}}
							className="p-0.5 rounded text-base-content/40 hover:text-base-content/80 hover:bg-base-200 transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</span>
					)}
					<Calendar className="w-4 h-4 text-base-content/50" />
				</span>
			</button>

			{open && (
				<div
					id={gridId}
					role="dialog"
					aria-label="Tarih seç"
					// Right-anchored so the calendar grows leftward inside narrow
					// containers (sheets, filter rows) instead of widening them.
					className="absolute right-0 z-40 mt-1.5 w-70 max-w-[calc(100vw-2rem)] rounded-xl border border-base-300 bg-base-100 shadow-pop p-3 animate-dropdown-in"
				>
					<div className="flex items-center justify-between mb-2">
						<button
							type="button"
							onClick={() => shiftMonth(-1)}
							aria-label="Önceki ay"
							className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>
						<span className="text-sm font-semibold">
							{MONTHS[view.m]} {view.y}
						</span>
						<button
							type="button"
							onClick={() => shiftMonth(1)}
							aria-label="Sonraki ay"
							className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
						>
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>

					<div className="grid grid-cols-7 gap-0.5 mb-1">
						{WEEKDAYS.map((w) => (
							<span key={w} className="h-6 flex items-center justify-center text-[0.65rem] font-semibold text-base-content/45">
								{w}
							</span>
						))}
					</div>

					<div className="grid grid-cols-7 gap-0.5">
						{Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
						{Array.from({ length: total }, (_, i) => {
							const day = i + 1;
							const iso = toISO(view.y, view.m, day);
							const isSelected = value === iso;
							const isToday = today.y === view.y && today.m === view.m && today.d === day;
							const outOfRange = isOutOfRange(iso);
							return (
								<button
									key={day}
									type="button"
									disabled={outOfRange}
									onClick={() => commit(day)}
									aria-current={isToday ? "date" : undefined}
									aria-pressed={isSelected}
									className={cn(
										"h-9 rounded-lg text-sm tabular-nums transition-colors",
										"hover:bg-base-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed",
										isSelected && "bg-primary text-primary-content font-semibold hover:bg-primary",
										!isSelected && isToday && "font-semibold text-primary",
									)}
								>
									{day}
								</button>
							);
						})}
					</div>

					<div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-base-300">
						<button
							type="button"
							onClick={() => {
								const t = todayParts();
								setView({ y: t.y, m: t.m });
								const iso = toISO(t.y, t.m, t.d);
								if (!isOutOfRange(iso)) {
									onChange(iso);
									setOpen(false);
									triggerRef.current?.focus();
								}
							}}
							className="text-sm font-medium text-primary hover:underline"
						>
							Bugün
						</button>
						{!required && (
							<button
								type="button"
								onClick={() => {
									onChange("");
									setOpen(false);
									triggerRef.current?.focus();
								}}
								className="text-sm text-base-content/60 hover:text-base-content"
							>
								Temizle
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function todayParts(): { y: number; m: number; d: number } {
	const now = new Date();
	return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}
