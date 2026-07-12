"use client";
import React, { useId, isValidElement, cloneElement } from "react";
import { TrashIcon } from "lucide-react";
import { cn } from "./cn";

interface FormFieldProps {
	label: string;
	children: React.ReactNode;
	hint?: string;
	/** Inline validation error — red border on the child input + message below. */
	error?: string;
	/** Explicit control id; auto-generated when omitted. */
	id?: string;
	onDelete?: () => void;
}

const errorInputClass = "border-error/40 focus:border-error/60 focus:ring-error/15";

/**
 * Labeled field wrapper. Wires label↔input (htmlFor/id), and when `error` is
 * set adds aria-invalid/aria-describedby + red border to a single-element child.
 */
export const FormField = ({ label, children, hint, error, id, onDelete }: FormFieldProps) => {
	const autoId = useId();
	const fieldId = id ?? autoId;
	const errorId = `${fieldId}-error`;
	const hintId = `${fieldId}-hint`;

	// Decorate the child only when it's a single element (Input/Select/Textarea).
	// Multi-node children (e.g. custom rows) render untouched.
	let content = children;
	if (isValidElement(children)) {
		const child = children as React.ReactElement<{
			id?: string;
			className?: string;
			"aria-invalid"?: boolean;
			"aria-describedby"?: string;
		}>;
		const describedBy =
			[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
		content = cloneElement(child, {
			id: child.props.id ?? fieldId,
			"aria-invalid": error ? true : undefined,
			"aria-describedby": describedBy ?? child.props["aria-describedby"],
			className: error ? cn(child.props.className, errorInputClass) : child.props.className,
		});
	}

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-1.5">
				<label htmlFor={fieldId} className="block text-xs font-semibold text-base-content/70">
					{label}
				</label>
				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="text-base-content/30 hover:text-error transition-colors p-1 -m-1"
						title="Alanı kaldır"
						aria-label={`${label} alanını kaldır`}
					>
						<TrashIcon size={14} />
					</button>
				)}
			</div>
			{content}
			{error && (
				<p id={errorId} className="mt-1 text-xs font-medium text-error">
					{error}
				</p>
			)}
			{hint && !error && (
				<p id={hintId} className="mt-1 text-xs text-base-content/50">
					{hint}
				</p>
			)}
		</div>
	);
};

/**
 * Shared input style — the redesigned "cleaner" field.
 * Taller (h-12 / 44px+), 16px text on mobile (no iOS zoom), soft border that
 * lifts to the primary accent on focus with a gentle ring. Used directly via
 * the className constant OR through the <Input/Textarea/Select> wrappers below.
 */
export const inputClass =
	"w-full h-12 bg-base-100 border border-base-300 rounded-lg px-3.5 text-base sm:text-sm text-base-content " +
	"placeholder:text-base-content/40 shadow-soft outline-none transition-all " +
	"focus:border-primary focus:ring-4 focus:ring-primary/15 " +
	"disabled:bg-base-200 disabled:text-base-content/50";

/** Textarea variant — same skin, auto height. */
export const textareaClass =
	"w-full min-h-24 bg-base-100 border border-base-300 rounded-lg px-3.5 py-3 text-base sm:text-sm text-base-content " +
	"placeholder:text-base-content/40 shadow-soft outline-none transition-all resize-y " +
	"focus:border-primary focus:ring-4 focus:ring-primary/15";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
	function Input({ className, ...rest }, ref) {
		return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
	},
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
	function Textarea({ className, ...rest }, ref) {
		return <textarea ref={ref} className={cn(textareaClass, className)} {...rest} />;
	},
);

// Native <select> wrapper removed — use <Dropdown> (./Dropdown.tsx) for all
// single-selects so every dropdown stays custom and keyboard-accessible.
