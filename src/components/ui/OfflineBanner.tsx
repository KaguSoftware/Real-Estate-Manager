"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/**
 * Fixed banner shown while the browser is offline, so a failed save is
 * explained before the user retries in confusion. Announced politely to
 * screen readers via role="status".
 */
function subscribe(onChange: () => void) {
	window.addEventListener("online", onChange);
	window.addEventListener("offline", onChange);
	return () => {
		window.removeEventListener("online", onChange);
		window.removeEventListener("offline", onChange);
	};
}

export function OfflineBanner() {
	// useSyncExternalStore: SSR renders "online" (no banner), the client then
	// syncs to the real connectivity state without a setState-in-effect.
	const offline = useSyncExternalStore(
		subscribe,
		() => !navigator.onLine,
		() => false,
	);

	if (!offline) return null;

	return (
		<div
			role="status"
			className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-neutral text-neutral-content text-xs font-semibold py-2 px-4 safe-top"
		>
			<WifiOff className="w-3.5 h-3.5" />
			Çevrimdışısınız — bağlantı geri gelene kadar değişiklikler kaydedilemez.
		</div>
	);
}
