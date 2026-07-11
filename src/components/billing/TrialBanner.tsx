"use client";

/**
 * Global trial/paywall banner. Rendered once in the root layout:
 *  - last 3 trial days → amber countdown with a subscribe link
 *  - trial over & no active subscription → red "read-only" banner
 * RLS is the real write lock; this keeps the user informed before they hit it.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TriangleAlert, Lock } from "lucide-react";
import { useAppStore } from "@/src/store";

export function useIsWritable(): boolean {
	const team = useAppStore((s) => s.team);
	// Optimistic before team context loads; the DB rejects if it's wrong.
	return team?.is_writable ?? true;
}

export function TrialBanner() {
	const team = useAppStore((s) => s.team);
	const pathname = usePathname();
	// Minute-granular clock via useSyncExternalStore: render stays pure and the
	// server snapshot (0) suppresses the banner until hydration.
	const now = useSyncExternalStore(
		(onTick) => {
			const t = setInterval(onTick, 60_000);
			return () => clearInterval(t);
		},
		() => Math.floor(Date.now() / 60_000) * 60_000,
		() => 0,
	);

	if (!team || now === 0 || pathname.startsWith("/settings/billing") || pathname.startsWith("/onboarding")) {
		return null;
	}

	const onTrial = team.subscription_status === "trialing" || team.subscription_status === null;
	const daysLeft = Math.ceil((new Date(team.trial_ends_at).getTime() - now) / 86_400_000);

	if (!team.is_writable) {
		return (
			<div className="sticky top-0 z-40 bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
				<Lock className="w-4 h-4 shrink-0" />
				<span>
					{onTrial ? "Your free trial has ended" : "Your subscription is inactive"} — the
					workspace is read-only.{" "}
					{team.role === "owner" ? (
						<Link href="/settings/billing" className="underline font-semibold">
							Subscribe to continue
						</Link>
					) : (
						"Ask your team owner to subscribe."
					)}
				</span>
			</div>
		);
	}

	if (onTrial && daysLeft <= 3) {
		return (
			<div className="sticky top-0 z-40 bg-amber-400 text-amber-950 text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
				<TriangleAlert className="w-4 h-4 shrink-0" />
				<span>
					{daysLeft <= 0
						? "Your free trial ends today"
						: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
					.{" "}
					{team.role === "owner" && (
						<Link href="/settings/billing" className="underline font-semibold">
							Choose a plan
						</Link>
					)}
				</span>
			</div>
		);
	}

	return null;
}
