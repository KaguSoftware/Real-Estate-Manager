import React from "react";
import { cn } from "./cn";

/** Consistent empty-state card — icon, heading, hint, optional action. */
export function EmptyState({
	icon: Icon,
	title,
	hint,
	action,
	className,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	title: string;
	hint?: string;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col items-center justify-center text-center px-6 py-10", className)}>
			{Icon && <Icon className="w-7 h-7 text-slate-400 mb-2" />}
			<p className="text-sm font-semibold text-slate-700">{title}</p>
			{hint && <p className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</p>}
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
