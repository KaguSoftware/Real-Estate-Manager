"use client";

import React, { useEffect, useRef, useState } from "react";
import {
	clamp,
	formatTrMoney,
	parseTrNumber,
	sanitizeNumericText,
	toEditingText,
} from "@/src/lib/numberFormat";
import { cn } from "./cn";
import { inputClass } from "./FormField";

interface NumberInputProps {
	/** null = empty field. */
	value: number | null;
	onChange: (value: number | null) => void;
	/** integer (default) rejects the decimal separator entirely. */
	mode?: "integer" | "decimal";
	/** Clamped on blur, not per keystroke (so "2" can be typed on min=10). */
	min?: number;
	max?: number;
	/** money: tr-TR thousands grouping while unfocused (12.500,5). */
	format?: "plain" | "money";
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	id?: string;
	className?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
}

/**
 * Numbers-only input replacing <input type="number">. Renders type="text"
 * with inputMode so keystrokes/paste can be filtered (native number inputs
 * still accept "e", leading junk on paste, and scroll-to-change). Keeps an
 * internal editing string so intermediate states like "12," type naturally;
 * commits a clamped number (or null) upward on every change.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
	{
		value,
		onChange,
		mode = "integer",
		min,
		max,
		format = "plain",
		placeholder,
		disabled,
		required,
		id,
		className,
		...aria
	},
	ref,
) {
	const [text, setText] = useState(() => toEditingText(value));
	const [focused, setFocused] = useState(false);
	// Last value we emitted — distinguishes our own echo from external resets.
	const lastEmitted = useRef<number | null>(value);

	useEffect(() => {
		if (value !== lastEmitted.current) {
			lastEmitted.current = value;
			setText(toEditingText(value));
		}
	}, [value]);

	const opts = { decimal: mode === "decimal", negative: min !== undefined && min < 0 };

	function emit(nextText: string) {
		setText(nextText);
		const n = parseTrNumber(nextText);
		lastEmitted.current = n;
		onChange(n);
	}

	function onBlur() {
		setFocused(false);
		const n = parseTrNumber(text);
		if (n === null) { emit(""); return; }
		const committed = clamp(mode === "integer" ? Math.trunc(n) : n, min, max);
		emit(toEditingText(committed));
	}

	const display =
		!focused && format === "money" && value !== null ? formatTrMoney(value) : text;

	return (
		<input
			ref={ref}
			type="text"
			inputMode={mode === "decimal" ? "decimal" : "numeric"}
			autoComplete="off"
			id={id}
			value={display}
			placeholder={placeholder}
			disabled={disabled}
			required={required}
			onFocus={() => setFocused(true)}
			onBlur={onBlur}
			onChange={(e) => emit(sanitizeNumericText(e.target.value, opts))}
			className={cn(inputClass, className)}
			{...aria}
		/>
	);
});
