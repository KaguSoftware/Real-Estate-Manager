"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useAppStore } from "@/src/store";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { NavDrawer } from "./NavDrawer";
import { Button } from "./Button";
import { AddMenu } from "./AddMenu";
import { cn } from "./cn";

interface AppShellProps {
	title: string;
	subtitle?: string;
	/** Right-aligned header actions (e.g. an Add button). */
	actions?: React.ReactNode;
	/** When false, hides the avatar/menu trigger area's user-specific bits. */
	children: React.ReactNode;
	/** Constrain main content width. Default max-w-5xl. */
	width?: "5xl" | "7xl" | "3xl";
}

/**
 * App-wide chrome: a sticky top bar with a hamburger (opens NavDrawer),
 * page title, optional actions, and a user avatar. Replaces the bespoke
 * per-page headers + wrapping link soup. Mobile-first and safe-area aware.
 */
export function AppShell({ title, subtitle, actions, children, width = "5xl" }: AppShellProps) {
	const user = useAppStore((s) => s.user);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [showAuth, setShowAuth] = useState(false);

	const maxW = width === "7xl" ? "max-w-7xl" : width === "3xl" ? "max-w-3xl" : "max-w-5xl";

	return (
		<div className="min-h-screen bg-base-200">
			<header className="safe-top sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200/80">
				<div className={cn("mx-auto px-3 sm:px-6 h-14 flex items-center gap-2", maxW)}>
					<button
						onClick={() => setDrawerOpen(true)}
						aria-label="Open menu"
						className="h-11 w-11 -ml-1 inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
					>
						<Menu className="w-5 h-5" />
					</button>

					<div className="min-w-0 flex-1">
						<h1 className="text-base font-bold text-slate-900 truncate leading-tight">{title}</h1>
						{subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
					</div>

					<div className="flex items-center gap-2">
						{actions}
						{user && <AddMenu />}
						{user ? (
							<button
								onClick={() => setDrawerOpen(true)}
								aria-label="Account"
								className="h-9 w-9 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold uppercase select-none shadow-soft"
							>
								{user.email.charAt(0)}
							</button>
						) : (
							<Button size="sm" onClick={() => setShowAuth(true)}>Sign in</Button>
						)}
					</div>
				</div>
			</header>

			{/* `safe-x` owns horizontal padding (base 12/24px + notch insets); don't
			    also set `px-*` here or the two longhands race in the cascade. */}
			<main className={cn("mx-auto py-4 sm:py-6 safe-x", maxW)}>{children}</main>

			<NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
			{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
		</div>
	);
}
