"use client";

import React, { useState } from "react";
import { required as requiredCheck, validEmail } from "@/src/lib/validation";
import { cn } from "./cn";
import { Input } from "./FormField";

interface EmailInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
	value: string;
	onChange: (value: string) => void;
	/** Also flag an empty field on blur (uses the shared required() message). */
	required?: boolean;
	/** Field label used in the "zorunludur" message when required. */
	label?: string;
	/** Reports the current inline error upward so parents can gate submit. */
	onValidChange?: (error: string | undefined) => void;
}

/**
 * Email field with the app's validEmail() enforced on blur: shows the Turkish
 * inline error itself and mirrors it via onValidChange. Errors clear as soon
 * as the user edits again. Inside FormField, prefer passing FormField's error
 * prop from onValidChange so the label wiring stays in one place.
 */
export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(function EmailInput(
	{ value, onChange, required, label = "E-posta", onValidChange, className, onBlur, ...rest },
	ref,
) {
	const [error, setError] = useState<string | undefined>(undefined);

	function report(next: string | undefined) {
		setError(next);
		onValidChange?.(next);
	}

	return (
		<div className="w-full">
			<Input
				ref={ref}
				type="email"
				inputMode="email"
				autoComplete="email"
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					if (error) report(undefined);
				}}
				onBlur={(e) => {
					report((required ? requiredCheck(value, label) : undefined) ?? validEmail(value));
					onBlur?.(e);
				}}
				aria-invalid={error ? true : rest["aria-invalid"]}
				className={cn(error && "border-error/40 focus:border-error/60 focus:ring-error/15", className)}
				{...rest}
			/>
			{error && !rest["aria-describedby"] && (
				<p className="mt-1 text-xs font-medium text-error">{error}</p>
			)}
		</div>
	);
});
