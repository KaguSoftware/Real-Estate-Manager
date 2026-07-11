"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useAppStore } from "@/src/store";
import { getTeamLogoUrl } from "@/src/lib/db/teams";
import { NotificationBell } from "@/src/components/notifications/NotificationBell";
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
	const team = useAppStore((s) => s.team);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const maxW = width === "7xl" ? "max-w-7xl" : width === "3xl" ? "max-w-3xl" : "max-w-5xl";
	const logoUrl = getTeamLogoUrl(team?.logo_path ?? null);

	return (
		<div className="min-h-screen bg-base-200">
			<header className="safe-top sticky top-0 z-30 bg-base-100/85 backdrop-blur border-b border-base-300/70">
				<div className={cn("mx-auto px-3 sm:px-6 h-16 flex items-center gap-2.5", maxW)}>
					<button
						onClick={() => setDrawerOpen(true)}
						aria-label="Menüyü aç"
						className="h-11 w-11 -ml-1 inline-flex items-center justify-center rounded-lg text-base-content/70 hover:bg-base-200 transition-colors"
					>
						<Menu className="w-5 h-5" />
					</button>

					{logoUrl && (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={logoUrl} alt={team?.name ?? "Ekip logosu"} className="h-8 w-auto max-w-27.5 object-contain shrink-0" />
					)}

					<div className="min-w-0 flex-1">
						<h1 className="font-display text-lg font-semibold text-base-content truncate leading-tight">{title}</h1>
						{subtitle && <p className="text-xs text-base-content/50 truncate tracking-wide">{subtitle}</p>}
					</div>

					<div className="flex items-center gap-2">
						{actions}
						{user && team && <NotificationBell />}
						{user && <AddMenu />}
						{user ? (
							<button
								onClick={() => setDrawerOpen(true)}
								aria-label="Hesap"
								className="h-9 w-9 rounded-full bg-primary text-primary-content ring-1 ring-primary/40 ring-offset-2 ring-offset-base-100 flex items-center justify-center text-sm font-bold uppercase select-none"
							>
								{user.email.charAt(0)}
							</button>
						) : (
							<Link href="/login"><Button size="sm">Giriş yap</Button></Link>
						)}
					</div>
				</div>
			</header>

			{/* `safe-x` owns horizontal padding (base 12/24px + notch insets); don't
			    also set `px-*` here or the two longhands race in the cascade. */}
			<main className={cn("mx-auto py-6 sm:py-10 safe-x", maxW)}>{children}</main>

			<NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
		</div>
	);
}
