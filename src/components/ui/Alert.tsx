import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "./cn";

type AlertTone = "error" | "warning" | "success" | "info";

const TONES: Record<AlertTone, { box: string; icon: React.ComponentType<{ className?: string }> }> = {
	error:   { box: "bg-error/10 border-error/40 text-error", icon: AlertCircle },
	warning: { box: "bg-warning/10 border-warning/30 text-warning", icon: AlertTriangle },
	success: { box: "bg-success/10 border-success/30 text-success", icon: CheckCircle2 },
	info:    { box: "bg-base-200 border-base-300 text-base-content/70", icon: Info },
};

/** Inline message box — replaces the ad-hoc red/amber divs across forms. */
export function Alert({
	tone = "error",
	children,
	action,
	className,
}: {
	tone?: AlertTone;
	children: React.ReactNode;
	/** Optional trailing action (e.g. a small button). */
	action?: React.ReactNode;
	className?: string;
}) {
	const { box, icon: Icon } = TONES[tone];
	return (
		<div
			role={tone === "error" ? "alert" : undefined}
			className={cn("flex items-start gap-2.5 p-3 rounded-xl border text-sm", box, className)}
		>
			<Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
			<div className="flex-1 min-w-0">{children}</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
