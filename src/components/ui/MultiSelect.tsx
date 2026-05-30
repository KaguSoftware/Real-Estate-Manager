"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

interface MultiSelectProps {
	/** Placeholder shown when nothing is selected (e.g. "Any type"). */
	label: string;
	options: string[];
	selected: string[];
	onChange: (next: string[]) => void;
	className?: string;
}

/**
 * Lightweight multi-select: a field-styled trigger button that opens a panel of
 * checkboxes. Dependency-free — matches the app's custom Tailwind field skin
 * (see inputClass in FormField). Closes on outside-click or Escape.
 */
export function MultiSelect({ label, options, selected, onChange, className }: MultiSelectProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function toggle(value: string) {
		onChange(
			selected.includes(value)
				? selected.filter((v) => v !== value)
				: [...selected, value],
		);
	}

	const summary =
		selected.length === 0
			? label
			: selected.length === 1
				? selected[0]
				: `${selected.length} selected`;

	return (
		<div ref={rootRef} className={cn("relative", className)}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"w-full h-12 flex items-center justify-between gap-2 bg-white border rounded-xl px-3.5 text-base sm:text-sm shadow-soft outline-none transition-all",
					"focus:border-primary focus:ring-4 focus:ring-primary/15",
					open ? "border-primary ring-4 ring-primary/15" : "border-slate-200",
					selected.length ? "text-slate-800" : "text-slate-400",
				)}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span className="truncate">{summary}</span>
				<ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
			</button>

			{open && (
				<div
					className="absolute z-40 mt-1.5 w-full min-w-44 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-pop p-1"
					role="listbox"
				>
					{options.length === 0 ? (
						<p className="px-3 py-2 text-xs text-slate-400">No options yet</p>
					) : (
						options.map((opt) => {
							const checked = selected.includes(opt);
							return (
								<button
									key={opt}
									type="button"
									onClick={() => toggle(opt)}
									className={cn(
										"w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors",
										checked ? "bg-primary/5 text-slate-900" : "text-slate-700 hover:bg-slate-100",
									)}
									role="option"
									aria-selected={checked}
								>
									<span
										className={cn(
											"w-4 h-4 shrink-0 rounded border flex items-center justify-center",
											checked ? "bg-primary border-primary text-primary-content" : "border-slate-300",
										)}
									>
										{checked && <Check className="w-3 h-3" strokeWidth={3} />}
									</span>
									<span className="truncate">{opt}</span>
								</button>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
