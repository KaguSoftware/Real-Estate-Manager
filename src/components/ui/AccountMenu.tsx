"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, LogOut, RefreshCw, HelpCircle } from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import { cn } from "./cn";

/**
 * Header "more" menu — logout / switch account / help. Sign-out and switch
 * account both land on /login: switching accounts is just signing out for a
 * different person to sign back in, same as onboarding's footer actions.
 */
export function AccountMenu() {
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

	async function signOutAndRedirect() {
		setOpen(false);
		await createClient().auth.signOut();
		router.push("/login");
	}

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label="Hesap menüsü"
				aria-haspopup="menu"
				aria-expanded={open}
				className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-base-content/70 hover:bg-base-200 transition-colors"
			>
				<MoreVertical className="w-4.5 h-4.5" />
			</button>

			{open && (
				<div
					className="absolute right-0 z-40 mt-1.5 w-48 rounded-xl border border-base-300 bg-base-100 shadow-pop p-1 animate-dropdown-in"
					role="menu"
				>
					<button
						type="button"
						onClick={signOutAndRedirect}
						className={cn(
							"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-base-content/80",
							"hover:bg-base-200 transition-colors",
						)}
						role="menuitem"
					>
						<LogOut className="w-4 h-4 shrink-0 text-base-content/60" />
						Çıkış yap
					</button>
					<button
						type="button"
						onClick={signOutAndRedirect}
						className={cn(
							"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-base-content/80",
							"hover:bg-base-200 transition-colors",
						)}
						role="menuitem"
					>
						<RefreshCw className="w-4 h-4 shrink-0 text-base-content/60" />
						Hesap değiştir
					</button>
					<a
						href="mailto:contact@kagusoftware.com"
						onClick={() => setOpen(false)}
						className={cn(
							"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-base-content/80",
							"hover:bg-base-200 transition-colors",
						)}
						role="menuitem"
					>
						<HelpCircle className="w-4 h-4 shrink-0 text-base-content/60" />
						Yardım
					</a>
				</div>
			)}
		</div>
	);
}
