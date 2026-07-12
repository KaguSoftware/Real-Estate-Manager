"use client";

/**
 * Sidebar — persistent desktop navigation (lg+). The mobile NavDrawer stays
 * for smaller screens; both read the same NAV_GROUPS so they never drift.
 *
 * Identity: a graphite rail (the kagu's ash-grey plumage) that stays dark in
 * BOTH themes, with the red-orange accent reserved for the active item — the
 * one committed surface in an otherwise restrained product UI.
 */

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { getTeamLogoUrl } from "@/src/lib/db/teams";
import { getAvatarUrl } from "@/src/lib/db/profiles";
import { useAppStore } from "@/src/store";
import { NAV_GROUPS, activeNavHref } from "@/src/lib/nav";
import { ThemeToggle } from "./ThemeToggle";
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

export function Sidebar() {
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const pathname = usePathname();
	const router = useRouter();

	if (!user) return null;
	const isAdmin = user.app_role === "admin";
	const groups = NAV_GROUPS.map((g) => ({
		...g,
		items: g.items.filter((i) => !i.adminOnly || isAdmin),
	})).filter((g) => g.items.length > 0);
	const allItems = groups.flatMap((g) => g.items);
	const activeHref = activeNavHref(pathname, allItems);

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
			<div className="px-5 pt-6 pb-5">
				<div className="flex items-center gap-3 min-w-0">
					{logoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain bg-white/10 p-1 shrink-0" />
					) : (
						<span className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-content flex items-center justify-center font-display text-base font-bold select-none">
							{(team?.name ?? "Kagu").charAt(0).toUpperCase()}
						</span>
					)}
					<div className="min-w-0">
						<p className="font-display text-[15px] font-semibold text-white leading-tight truncate">
							{team?.name ?? "Kagu Emlak"}
						</p>
						<p className="text-[11px] text-white/40 truncate">{team ? "Çalışma alanı" : "Yönetici"}</p>
					</div>
				</div>
			</div>

			{/* Nav groups */}
			<nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
				{groups.map((g, gi) => (
					<div key={g.label ?? gi}>
						{g.label && (
							<p className="px-3 mb-1 text-[11px] font-semibold text-white/35">{g.label}</p>
						)}
						<ul className="space-y-0.5">
							{g.items.map(({ href, label, icon: Icon }) => {
								const active = activeHref === href;
								return (
									<li key={href}>
										<Link
											href={href}
											aria-current={active ? "page" : undefined}
											className={cn(
												"group flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors duration-150",
												active
													? "bg-primary text-primary-content font-semibold shadow-soft"
													: "text-white/70 hover:text-white hover:bg-white/5",
											)}
										>
											<Icon
												className={cn(
													"w-[18px] h-[18px] shrink-0 transition-colors duration-150",
													active ? "" : "text-white/45 group-hover:text-white/80",
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

			{/* Footer: theme + identity */}
			<div className="px-3 pb-4 pt-3 border-t border-white/10 space-y-2">
				<div className="px-2">
					<ThemeToggle />
				</div>
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
