"use client";

/**
 * Sidebar — persistent desktop navigation (lg+). The mobile NavDrawer stays
 * for smaller screens; both read the same NAV_GROUPS so they never drift.
 *
 * Identity: a graphite rail (the kagu's ash-grey plumage) that stays dark in
 * BOTH themes. Instead of the usual pill-highlight nav, a single vertical
 * "flight line" runs through the items and one orange marker (the kagu's
 * bill) slides along it to the active route — the one committed accent in an
 * otherwise restrained product UI.
 */

import { useLayoutEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { getTeamLogoUrl } from "@/src/lib/db/teams";
import { getAvatarUrl } from "@/src/lib/db/profiles";
import { useAppStore } from "@/src/store";
import { NAV_GROUPS, activeNavHref } from "@/src/lib/nav";
import { ThemeToggleButton } from "./ThemeToggle";
import { cn } from "./cn";
import { LogOut } from "lucide-react";

/** Spinner shown while this link's navigation is in flight (useLinkStatus). */
function PendingHint() {
	const { pending } = useLinkStatus();
	if (!pending) return null;
	return (
		<span
			aria-hidden
			className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin"
		/>
	);
}

/** x-center of the flight line inside the <nav>, in px (matches left-[27px] + w-px). */
const LINE_X = 27;

export function Sidebar() {
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const pathname = usePathname();
	const router = useRouter();

	const navRef = useRef<HTMLElement>(null);
	const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
	const markerRef = useRef<HTMLSpanElement>(null);

	const isAdmin = user?.app_role === "admin";
	const groups = NAV_GROUPS.map((g) => ({
		...g,
		items: g.items.filter((i) => !i.adminOnly || isAdmin),
	})).filter((g) => g.items.length > 0);
	const allItems = groups.flatMap((g) => g.items);
	const activeHref = user ? activeNavHref(pathname, allItems) : null;

	// Position the marker on the vertical center of the active link. offsetTop
	// is measured against the <nav> (its offsetParent, via `relative`), so the
	// marker scrolls together with the items.
	useLayoutEffect(() => {
		const marker = markerRef.current;
		if (!marker) return;
		const el = activeHref ? itemRefs.current.get(activeHref) : null;
		if (el) {
			marker.style.opacity = "1";
			marker.style.transform = `translateY(${el.offsetTop + el.offsetHeight / 2 - 3.5}px)`;
		} else {
			marker.style.opacity = "0";
		}
	}, [activeHref, isAdmin]);

	if (!user) return null;

	const logoUrl = getTeamLogoUrl(team?.logo_path ?? null);
	const avatarUrl = getAvatarUrl(user.avatar_path ?? null);

	async function handleSignOut() {
		await createClient().auth.signOut();
		router.push("/");
	}

	return (
		<aside
			aria-label="Ana gezinme"
			className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-[#1b202a] text-white/80 safe-top safe-bottom"
		>
			{/* Workspace identity */}
			<div className="px-5 pt-6 pb-6">
				<div className="flex items-center gap-3 min-w-0">
					{logoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain bg-white/10 p-1 shrink-0" />
					) : (
						<span className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-content flex items-center justify-center font-display text-base font-bold select-none">
							{(team?.name ?? "Kagu").charAt(0).toUpperCase()}
						</span>
					)}
					<div className="min-w-0 flex-1">
						<p className="font-display text-[15px] font-semibold text-white leading-tight truncate">
							{team?.name ?? "Kagu Emlak"}
						</p>
						<p className="text-[11px] text-white/40 truncate">{team ? "Çalışma alanı" : "Yönetici"}</p>
					</div>
					<ThemeToggleButton className="-mr-1.5" />
				</div>
			</div>

			{/* Nav: flight line + sliding marker */}
			<nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 pb-4">
				{/* The line itself. Fades out at both ends instead of hard-stopping. */}
				<span
					aria-hidden
					className="pointer-events-none absolute top-0 bottom-0 w-px bg-linear-to-b from-transparent via-white/12 to-transparent"
					style={{ left: LINE_X }}
				/>
				{/* The kagu's bill: one marker for the whole nav, gliding to the active item. */}
				<span
					ref={markerRef}
					aria-hidden
					className="pointer-events-none absolute z-10 h-1.75 w-1.75 rounded-full bg-primary shadow-[0_0_10px_2px_--theme(--color-primary/45%)] transition-transform duration-200 ease-out motion-reduce:transition-none"
					style={{ left: LINE_X - 3, top: 0, opacity: 0 }}
				/>

				{groups.map((g, gi) => (
					<div key={g.label ?? gi} className="pt-6 first:pt-0">
						{g.label && (
							<p className="mb-1.5 pl-10 text-[11px] font-semibold text-white/30">{g.label}</p>
						)}
						<ul>
							{g.items.map(({ href, label, icon: Icon }) => {
								const active = activeHref === href;
								return (
									<li key={href}>
										<Link
											href={href}
											aria-current={active ? "page" : undefined}
											ref={(el) => {
												if (el) itemRefs.current.set(href, el);
												else itemRefs.current.delete(href);
											}}
											className={cn(
												"group flex items-center gap-3 h-11 pl-10 pr-3 text-sm transition-colors duration-150",
												active
													? "text-white font-semibold"
													: "font-medium text-white/55 hover:text-white",
											)}
										>
											<Icon
												className={cn(
													"w-4.5 h-4.5 shrink-0 transition-colors duration-150",
													active ? "text-primary" : "text-white/35 group-hover:text-white/75",
												)}
											/>
											{label}
											<PendingHint />
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</nav>

			{/* Footer: identity (theme toggle lives next to the workspace name) */}
			<div className="px-3 pb-4 pt-3 border-t border-white/10 space-y-2">
				<div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
					<span className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold uppercase select-none overflow-hidden">
						{avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={avatarUrl} alt="Profil fotoğrafı" className="h-full w-full object-cover" />
						) : (
							user.email.charAt(0)
						)}
					</span>
					<p className="min-w-0 flex-1 text-xs font-medium text-white/70 truncate">{user.email}</p>
					<button
						onClick={handleSignOut}
						title="Çıkış yap"
						aria-label="Çıkış yap"
						className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-white/45 hover:text-error hover:bg-white/10 transition-colors"
					>
						<LogOut className="w-4 h-4" />
					</button>
				</div>
			</div>
		</aside>
	);
}
