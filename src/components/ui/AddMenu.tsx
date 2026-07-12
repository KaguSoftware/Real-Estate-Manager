"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Home, Users, UserPlus, FilePlus2, Lock } from "lucide-react";
import { useAppStore, useIsWritable } from "@/src/store";
import { cn } from "./cn";

interface AddItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const ITEMS: AddItem[] = [
	{ href: "/properties/new", label: "Taşınmaz ekle", icon: Home },
	// Clients are created via an in-page modal on /leads (no dedicated route);
	// the ?new= flag tells ContactDashboard which create form to open on arrival.
	{ href: "/leads?new=lead", label: "Müşteri ekle", icon: Users },
	{ href: "/leads?new=tenant", label: "Kiracı ekle", icon: UserPlus },
	{ href: "/documents/new", label: "Yeni belge", icon: FilePlus2 },
];

/**
 * Global "Add" dropdown for the app header — lets the user pick what to create
 * regardless of which page they're on. Closes on outside-click or Escape.
 */
export function AddMenu() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	// RLS would reject the write anyway; surfacing the paywall here beats a
	// form that fails on submit.
	const writable = useIsWritable();
	const isOwner = useAppStore((s) => s.team?.role === "owner");

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
				<span className="hidden sm:inline">Ekle</span>
			</button>

			{open && !writable && (
				<div className="absolute right-0 z-40 mt-1.5 w-64 rounded-xl border border-base-300 bg-base-100 shadow-pop p-4 text-sm text-base-content/70">
					<p className="flex items-center gap-2 font-semibold text-base-content">
						<Lock className="w-4 h-4" /> Çalışma alanı salt okunur
					</p>
					<p className="mt-1.5">
						{isOwner ? (
							<>Yeni kayıt eklemek için <Link href="/settings/billing" className="text-primary underline" onClick={() => setOpen(false)}>aboneliğinizi etkinleştirin</Link>.</>
						) : (
							"Yeni kayıt eklemek için ekip sahibinizin abonelik başlatması gerekiyor."
						)}
					</p>
				</div>
			)}
			{open && writable && (
				<div
					className="absolute right-0 z-40 mt-1.5 w-48 rounded-xl border border-base-300 bg-base-100 shadow-pop p-1 animate-dropdown-in"
					role="menu"
				>
					{ITEMS.map(({ href, label, icon: Icon }) => (
						<button
							key={href}
							type="button"
							onClick={() => go(href)}
							className={cn(
								"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-base-content/80",
								"hover:bg-base-200 transition-colors",
							)}
							role="menuitem"
						>
							<Icon className="w-4 h-4 shrink-0 text-base-content/60" />
							{label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
