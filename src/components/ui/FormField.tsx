"use client";
import React from "react";
import { TrashIcon } from "lucide-react";

interface FormFieldProps {
	label: string;
	children: React.ReactNode;
	onDelete?: () => void;
}

export const FormField = ({ label, children, onDelete }: FormFieldProps) => {
	return (
		<div className="form-control w-full">
			<div className="flex items-center justify-between mb-2 px-1">
				<label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
					{label}
				</label>
				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="text-slate-300 hover:text-red-400 transition-colors"
						title="Remove field"
					>
						<TrashIcon size={12} />
					</button>
				)}
			</div>
			{children}
		</div>
	);
};

export const inputClass =
	"w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none placeholder:text-slate-400 shadow-sm";
