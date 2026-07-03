"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Home, Users, UserPlus, FilePlus2 } from "lucide-react";
import { cn } from "./cn";

interface AddItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const ITEMS: AddItem[] = [
	{ href: "/properties/new", label: "Add property", icon: Home },
	// Clients are created via an in-page modal on /leads (no dedicated route);
	// the ?new=1 flag tells LeadDashboard to open the create form on arrival.
	{ href: "/leads?new=1", label: "Add client", icon: Users },
	{ href: "/tenants?new=1", label: "Add tenant", icon: UserPlus },
	{ href: "/documents/new", label: "New document", icon: FilePlus2 },
];

/**
 * Global "Add" dropdown for the app header — lets the user pick what to create
 * regardless of which page they're on. Closes on outside-click or Escape.
 */
export function AddMenu() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function go(href: string) {
		setOpen(false);
		router.push(href);
	}

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-primary text-primary-content text-sm font-semibold shadow-soft hover:brightness-110 transition-all"
				aria-haspopup="menu"
				aria-expanded={open}
			>
				<Plus className="w-4 h-4" />
				<span className="hidden sm:inline">Add</span>
			</button>

			{open && (
				<div
					className="absolute right-0 z-40 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white shadow-pop p-1"
					role="menu"
				>
					{ITEMS.map(({ href, label, icon: Icon }) => (
						<button
							key={href}
							type="button"
							onClick={() => go(href)}
							className={cn(
								"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-slate-700",
								"hover:bg-slate-100 transition-colors",
							)}
							role="menuitem"
						>
							<Icon className="w-4 h-4 shrink-0 text-slate-500" />
							{label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
