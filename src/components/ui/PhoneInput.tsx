"use client";

import React from "react";
import { cn } from "./cn";
import { Input } from "./FormField";

interface PhoneInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
	value: string;
	onChange: (value: string) => void;
}

/** Digits, spaces, () and -, plus a leading "+". No masking — TR formats vary. */
export function sanitizePhoneText(raw: string): string {
	const plus = raw.trimStart().startsWith("+") ? "+" : "";
	return plus + raw.replace(/[^\d\s()-]/g, "");
}

/** Phone field that silently drops non-phone characters on type and paste. */
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
			value={value}
			onChange={(e) => onChange(sanitizePhoneText(e.target.value))}
			className={cn(className)}
			{...rest}
		/>
	);
});
