"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "./cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
	id: number;
	kind: ToastKind;
	message: string;
}

interface ToastState {
	toasts: ToastItem[];
	push: (kind: ToastKind, message: string) => void;
	dismiss: (id: number) => void;
}

let nextId = 1;

// Errors stay longer — users need time to read what went wrong.
const DURATION: Record<ToastKind, number> = { success: 3500, info: 3500, error: 6000 };

const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	push: (kind, message) => {
		const id = nextId++;
		set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
		}, DURATION[kind]);
	},
	dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helpers — callable from any handler, no hook needed. */
export const toast = {
	success: (message: string) => useToastStore.getState().push("success", message),
	error: (message: string) => useToastStore.getState().push("error", message),
	info: (message: string) => useToastStore.getState().push("info", message),
};

const KIND_STYLES: Record<ToastKind, { box: string; icon: React.ComponentType<{ className?: string }> }> = {
	success: { box: "bg-success/10 border-success/30 text-success", icon: CheckCircle2 },
	error:   { box: "bg-error/10 border-error/40 text-error", icon: AlertCircle },
	info:    { box: "bg-base-200 border-base-300 text-base-content/80", icon: Info },
};

/** Fixed toast stack. Mounted once in the root layout. */
export function ToastHost() {
	const toasts = useToastStore((s) => s.toasts);
	const dismiss = useToastStore((s) => s.dismiss);

	return (
		<div
			aria-live="polite"
			role="status"
			className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-70 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none safe-bottom"
		>
			{toasts.map(({ id, kind, message }) => {
				const { box, icon: Icon } = KIND_STYLES[kind];
				return (
					<div
						key={id}
						className={cn(
							"pointer-events-auto flex items-start gap-2.5 w-full sm:w-auto sm:max-w-sm",
							"px-4 py-3 rounded-xl border shadow-pop text-sm font-medium",
							"animate-[toastIn_.18s_ease-out]",
							box,
						)}
					>
						<Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
						<span className="flex-1 min-w-0 break-words">{message}</span>
						<button
							onClick={() => dismiss(id)}
							aria-label="Bildirimi kapat"
							className="shrink-0 -m-1 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				);
			})}
			<style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
		</div>
	);
}
