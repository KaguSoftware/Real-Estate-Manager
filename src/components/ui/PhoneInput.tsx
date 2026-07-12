"use client";

import React from "react";
import { cn } from "./cn";
import { Input } from "./FormField";

interface PhoneInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
	value: string;
	onChange: (value: string) => void;
}

/** Digits, spaces, () and -, plus a leading "+". Fallback for non-TR numbers. */
export function sanitizePhoneText(raw: string): string {
	const plus = raw.trimStart().startsWith("+") ? "+" : "";
	return plus + raw.replace(/[^\d\s()-]/g, "");
}

/**
 * TR display mask: "0 (5xx) xxx xx xx", applied progressively as the user
 * types. Pasted "+90 5xx…" / "90 5xx…" is normalized to the national form.
 * Numbers with a non-Turkish "+" country code are left unmasked (sanitized
 * only) — TR formats are the product's norm, everything else is an edge case.
 */
export function formatTrPhone(raw: string): string {
	const trimmed = raw.trimStart();
	let digits = trimmed.replace(/\D/g, "");

	if (trimmed.startsWith("+")) {
		if (digits.startsWith("90") && digits.length > 2) digits = "0" + digits.slice(2);
		else return sanitizePhoneText(raw); // foreign country code — don't mask
	} else if (digits.startsWith("90") && digits.length > 10) {
		digits = "0" + digits.slice(2); // "90 5xx…" pasted without the +
	} else if (digits.length > 0 && !digits.startsWith("0")) {
		digits = "0" + digits; // "5xx…" typed without the trunk 0
	}

	digits = digits.slice(0, 11);
	const area = digits.slice(1, 4);
	const p1 = digits.slice(4, 7);
	const p2 = digits.slice(7, 9);
	const p3 = digits.slice(9, 11);

	let out = digits.slice(0, 1);
	if (area) out += ` (${area}${area.length === 3 ? ")" : ""}`;
	if (p1) out += ` ${p1}`;
	if (p2) out += ` ${p2}`;
	if (p3) out += ` ${p3}`;
	return out;
}

/** Phone field that masks Turkish numbers as "0 (5xx) xxx xx xx" while typing. */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
	{ value, onChange, className, ...rest },
	ref,
) {
	return (
		<Input
			ref={ref}
			type="tel"
			inputMode="tel"
			autoComplete="tel"
			placeholder="0 (5xx) xxx xx xx"
			value={value}
			onChange={(e) => {
				const next = e.target.value;
				// Deleting a trailing mask character (space/paren) must actually
				// shrink the number — reformatting alone would re-add it and trap
				// the caret. Drop the last digit instead.
				if (next.length < value.length && formatTrPhone(next) === value) {
					const digits = next.replace(/\D/g, "");
					onChange(formatTrPhone(digits.slice(0, -1)));
					return;
				}
				onChange(formatTrPhone(next));
			}}
			className={cn(className)}
			{...rest}
		/>
	);
});
