"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface DropdownOption<T extends string = string> {
	value: T;
	label: string;
	disabled?: boolean;
	/** Optional color dots rendered before the label (e.g. palette presets). */
	swatches?: string[];
}

interface DropdownProps<T extends string = string> {
	options: DropdownOption<T>[];
	/** "" = nothing selected (matches the app's empty-sentinel pattern). */
	value: T | "";
	onChange: (value: T) => void;
	/** Shown when value === "" and there is no matching "" option. */
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	/** Serializes the value for uncontrolled <form> readers (rare). */
	name?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
}

function Swatches({ colors }: { colors: string[] }) {
	return (
		<span className="flex shrink-0 -space-x-1" aria-hidden>
			{colors.map((c, i) => (
				<span
					key={i}
					className="h-3.5 w-3.5 rounded-full border border-base-100 ring-1 ring-base-300/60"
					style={{ backgroundColor: c }}
				/>
			))}
		</span>
	);
}

/**
 * Custom single-select replacing the native <select>: ARIA combobox trigger +
 * listbox panel. Dependency-free, keyboard-complete (arrows, Home/End,
 * Enter/Space, Escape, typeahead), matches the shared field skin. Modeled on
 * MultiSelect; plays nice with FormField's cloneElement decoration (id,
 * aria-invalid, aria-describedby, error className land on the trigger).
 */
export function Dropdown<T extends string = string>({
	options,
	value,
	onChange,
	placeholder,
	disabled,
	id,
	className,
	name,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
	"aria-label": ariaLabel,
}: DropdownProps<T>) {
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(-1);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);
	const typeahead = useRef<{ query: string; at: number }>({ query: "", at: 0 });
	const listboxId = useId();

	const selectedIndex = useMemo(
		() => options.findIndex((o) => o.value === value),
		[options, value],
	);
	const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	// Keep the highlighted option scrolled into view.
	useEffect(() => {
		if (!open || highlighted < 0) return;
		listRef.current
			?.querySelector(`[data-index="${highlighted}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [open, highlighted]);

	function openPanel(startAt?: number) {
		setHighlighted(startAt ?? (selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1)));
		setOpen(true);
	}

	function firstEnabled(from: number, dir: 1 | -1): number {
		for (let i = from; i >= 0 && i < options.length; i += dir) {
			if (!options[i].disabled) return i;
		}
		return -1;
	}

	function move(from: number, dir: 1 | -1) {
		const next = firstEnabled(from + dir, dir);
		if (next >= 0) setHighlighted(next);
	}

	function commit(index: number) {
		const opt = options[index];
		if (!opt || opt.disabled) return;
		onChange(opt.value);
		setOpen(false);
		triggerRef.current?.focus();
	}

	function onTypeahead(char: string) {
		const now = Date.now();
		const t = typeahead.current;
		t.query = (now - t.at > 700 ? "" : t.query) + char.toLocaleLowerCase("tr-TR");
		t.at = now;
		const start = (open && highlighted >= 0 ? highlighted : selectedIndex) + 1;
		const ordered = [...options.keys()].slice(start).concat([...options.keys()].slice(0, start));
		const hit = ordered.find(
			(i) => !options[i].disabled && options[i].label.toLocaleLowerCase("tr-TR").startsWith(t.query),
		);
		if (hit === undefined) return;
		if (open) setHighlighted(hit);
		else commit(hit);
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (disabled) return;
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (open) move(highlighted, 1); else openPanel();
				break;
			case "ArrowUp":
				e.preventDefault();
				if (open) move(highlighted, -1); else openPanel();
				break;
			case "Home":
				if (open) { e.preventDefault(); setHighlighted(firstEnabled(0, 1)); }
				break;
			case "End":
				if (open) { e.preventDefault(); setHighlighted(firstEnabled(options.length - 1, -1)); }
				break;
			case "Enter":
			case " ":
				e.preventDefault();
				if (open) commit(highlighted); else openPanel();
				break;
			case "Escape":
				if (open) { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
				break;
			case "Tab":
				setOpen(false);
				break;
			default:
				if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) onTypeahead(e.key);
		}
	}

	// className sizes the WRAPPER (like MultiSelect) — putting widths on the
	// inner button while the wrapper stayed w-full made every inline filter row
	// collapse into overlapping full-width controls.
	return (
		<div ref={rootRef} className={cn("relative w-full", className)}>
			<button
				ref={triggerRef}
				type="button"
				id={id}
				disabled={disabled}
				onClick={() => (open ? setOpen(false) : openPanel())}
				onKeyDown={onKeyDown}
				role="combobox"
				aria-expanded={open}
				aria-haspopup="listbox"
				aria-controls={open ? listboxId : undefined}
				aria-activedescendant={open && highlighted >= 0 ? `${listboxId}-${highlighted}` : undefined}
				aria-invalid={ariaInvalid}
				aria-describedby={ariaDescribedBy}
				aria-label={ariaLabel}
				className={cn(
					"w-full h-12 flex items-center justify-between gap-2 bg-base-100 border border-base-300 rounded-lg px-3.5",
					"text-base sm:text-sm text-left shadow-soft outline-none transition-all",
					"focus:border-primary focus:ring-4 focus:ring-primary/15",
					"disabled:bg-base-200 disabled:text-base-content/50",
					open && "border-primary ring-4 ring-primary/15",
					selected ? "text-base-content" : "text-base-content/40",
					// FormField's error class lands on the wrapper now; mirror it here.
					ariaInvalid && "border-error/40 focus:border-error/60 focus:ring-error/15",
				)}
			>
				<span className="flex items-center gap-2 truncate">
					{selected?.swatches && <Swatches colors={selected.swatches} />}
					<span className="truncate">{selected?.label ?? placeholder ?? "Seçin"}</span>
				</span>
				<ChevronDown
					className={cn("w-4 h-4 shrink-0 text-base-content/50 transition-transform", open && "rotate-180")}
				/>
			</button>
			{name && <input type="hidden" name={name} value={value} />}

			{open && (
				<div
					ref={listRef}
					id={listboxId}
					role="listbox"
					// Anchored to the trigger's right edge: on a narrow trigger (e.g. a
					// currency picker) the menu is wider than its button, and growing
					// leftward keeps it inside the dialog instead of pushing the sheet
					// wide and creating a horizontal scrollbar. min-w is in ch so the
					// menu tracks translated label lengths rather than a fixed 176px.
					className="absolute right-0 z-40 mt-1.5 min-w-full w-max max-w-[min(16rem,calc(100vw-2rem))] max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border border-base-300 bg-base-100 shadow-pop p-1 animate-dropdown-in"
				>
					{options.length === 0 ? (
						<p className="px-3 py-2 text-xs text-base-content/50">Henüz seçenek yok</p>
					) : (
						options.map((opt, i) => {
							const isSelected = i === selectedIndex;
							return (
								<button
									key={`${opt.value}-${i}`}
									type="button"
									data-index={i}
									id={`${listboxId}-${i}`}
									role="option"
									aria-selected={isSelected}
									aria-disabled={opt.disabled || undefined}
									disabled={opt.disabled}
									tabIndex={-1}
									onMouseEnter={() => !opt.disabled && setHighlighted(i)}
									onClick={() => commit(i)}
									className={cn(
										"w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 rounded-lg text-sm text-left transition-colors",
										isSelected ? "bg-primary/5 text-base-content font-medium" : "text-base-content/80",
										i === highlighted && !opt.disabled && "bg-base-200",
										opt.disabled && "opacity-40 cursor-not-allowed",
									)}
								>
									<span className="flex items-center gap-2 truncate">
										{opt.swatches && <Swatches colors={opt.swatches} />}
										<span className="truncate">{opt.label}</span>
									</span>
									{isSelected && <Check className="w-4 h-4 shrink-0 text-primary" strokeWidth={2.5} />}
								</button>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
