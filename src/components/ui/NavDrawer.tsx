"use client";

import { useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";
import { cn } from "./cn";
import { useFocusTrap } from "./useFocusTrap";
import { LayoutDashboard, Home, Users, ContactRound, FilePlus2, Shield, LogOut, X } from "lucide-react";

interface NavItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	adminOnly?: boolean;
}

const NAV: NavItem[] = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/properties", label: "Properties", icon: Home },
	{ href: "/leads", label: "Clients", icon: Users },
	{ href: "/tenants", label: "Tenants", icon: ContactRound },
	{ href: "/documents/new", label: "New document", icon: FilePlus2 },
	{ href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

/** Spinner shown while this link's navigation is in flight (useLinkStatus). */
function PendingHint() {
	const { pending } = useLinkStatus();
	if (!pending) return null;
	return (
		<span
			aria-hidden
			className="ml-auto h-4 w-4 rounded-full border-2 border-slate-200 border-t-primary animate-spin"
		/>
	);
}

export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const user = useAppStore((s) => s.user);
	const pathname = usePathname();
	const router = useRouter();
	const panelRef = useRef<HTMLElement>(null);
	useFocusTrap(panelRef, open);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	async function handleSignOut() {
		const supabase = createClient();
		// Store + cache clearing happens centrally in AuthProvider's
		// SIGNED_OUT handler — no per-slice cleanup here.
		await supabase.auth.signOut();
		onClose();
		router.push("/");
	}

	const isAdmin = user?.app_role === "admin";
	const items = NAV.filter((i) => !i.adminOnly || isAdmin);

	return (
		<>
			{/* Backdrop */}
			<div
				className={cn(
					"fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200",
					open ? "opacity-100" : "opacity-0 pointer-events-none",
				)}
				onClick={onClose}
			/>
			{/* Drawer panel */}
			<aside
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Navigation menu"
				tabIndex={-1}
				inert={!open}
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs bg-white shadow-pop flex flex-col",
					"transition-transform duration-200 ease-out safe-top safe-bottom",
					open ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
					<div className="min-w-0">
						<p className="text-base font-bold text-slate-900 leading-tight">Real Estate</p>
						<p className="text-xs text-slate-400 truncate">Manager</p>
					</div>
					<button
						onClick={onClose}
						aria-label="Close menu"
						className="-mr-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto p-3">
					{items.map(({ href, label, icon: Icon }) => {
						const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
						return (
							<Link
								key={href}
								href={href}
								onClick={onClose}
								className={cn(
									"flex items-center gap-3 h-12 px-3 rounded-xl text-sm font-semibold transition-colors",
									active
										? "bg-primary/10 text-primary"
										: "text-slate-700 hover:bg-slate-100",
								)}
							>
								<Icon className="w-5 h-5 shrink-0" />
								{label}
								<PendingHint />
							</Link>
						);
					})}
				</nav>

				{user && (
					<div className="border-t border-slate-100 p-3">
						<div className="px-3 py-2">
							<p className="text-xs text-slate-400">Signed in as</p>
							<p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
						</div>
						<button
							onClick={handleSignOut}
							className="flex items-center gap-3 w-full h-12 px-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
						>
							<LogOut className="w-5 h-5" />
							Sign out
						</button>
					</div>
				)}
			</aside>
		</>
	);
}
