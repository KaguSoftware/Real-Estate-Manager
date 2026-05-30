"use client";
import React from "react";
import { TrashIcon } from "lucide-react";
import { cn } from "./cn";

interface FormFieldProps {
	label: string;
	children: React.ReactNode;
	hint?: string;
	onDelete?: () => void;
}

/** Labeled field wrapper. Calmer label (text-xs, not 10px), more breathing room. */
export const FormField = ({ label, children, hint, onDelete }: FormFieldProps) => {
	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-1.5">
				<label className="block text-xs font-semibold text-slate-600">{label}</label>
				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="text-slate-300 hover:text-red-500 transition-colors p-1 -m-1"
						title="Remove field"
					>
						<TrashIcon size={14} />
					</button>
				)}
			</div>
			{children}
			{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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
	"w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 text-base sm:text-sm text-slate-800 " +
	"placeholder:text-slate-400 shadow-soft outline-none transition-all " +
	"focus:border-primary focus:ring-4 focus:ring-primary/15 " +
	"disabled:bg-slate-50 disabled:text-slate-400";

/** Textarea variant — same skin, auto height. */
export const textareaClass =
	"w-full min-h-24 bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-base sm:text-sm text-slate-800 " +
	"placeholder:text-slate-400 shadow-soft outline-none transition-all resize-y " +
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

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
	function Select({ className, children, ...rest }, ref) {
		return (
			<select ref={ref} className={cn(inputClass, "appearance-none pr-9 bg-no-repeat", className)}
				style={{
					backgroundImage:
						"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
					backgroundPosition: "right 0.625rem center",
				}}
				{...rest}
			>
				{children}
			</select>
		);
	},
);
