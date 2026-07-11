"use client";

/**
 * NotificationBell — header bell with an unread badge; opens a Sheet listing
 * the user's in-app notifications (newest first) and marks them read.
 * Count refreshes on mount, window focus, and whenever the sheet closes.
 * No realtime channel for v1 — the bell is an inbox, not a chat.
 */

import { useCallback, useEffect, useState } from "react";
import { Bell, PartyPopper, UserPlus, Clock, CreditCard, AlertTriangle } from "lucide-react";
import {
	listNotifications,
	unreadNotificationCount,
	markNotificationsRead,
	type AppNotification,
	type NotificationType,
} from "@/src/lib/db/notifications";
import { Sheet, Spinner, EmptyState, cn } from "@/src/components/ui";

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
	trial_started: PartyPopper,
	invite_accepted: UserPlus,
	member_joined: PartyPopper,
	trial_ending: Clock,
	trial_ended: AlertTriangle,
	subscription_activated: CreditCard,
};

function timeAgo(iso: string): string {
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return "az önce";
	if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
	if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
	return `${Math.floor(s / 86400)} gün önce`;
}

export function NotificationBell() {
	const [unread, setUnread] = useState(0);
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[] | null>(null);

	const refreshCount = useCallback(() => {
		unreadNotificationCount().then(setUnread).catch(() => {});
	}, []);

	useEffect(() => {
		refreshCount();
		window.addEventListener("focus", refreshCount);
		return () => window.removeEventListener("focus", refreshCount);
	}, [refreshCount]);

	async function openSheet() {
		setOpen(true);
		setItems(null);
		try {
			const list = await listNotifications();
			setItems(list);
			const unreadIds = list.filter((n) => !n.read_at).map((n) => n.id);
			if (unreadIds.length) {
				await markNotificationsRead(unreadIds);
				setUnread(0);
			}
		} catch {
			setItems([]);
		}
	}

	return (
		<>
			<button
				onClick={openSheet}
				aria-label={unread > 0 ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
				className="relative h-11 w-11 inline-flex items-center justify-center rounded-xl text-base-content/70 hover:bg-base-200 transition-colors"
			>
				<Bell className="w-5 h-5" />
				{unread > 0 && (
					<span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-content text-[10px] font-bold flex items-center justify-center">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</button>

			<Sheet open={open} onClose={() => { setOpen(false); refreshCount(); }} title="Bildirimler">
				{items === null ? (
					<div className="py-8 flex justify-center"><Spinner /></div>
				) : items.length === 0 ? (
					<EmptyState
						icon={Bell}
						title="Henüz bildirim yok"
						hint="Ekip ve abonelik güncellemeleri burada görünecek."
					/>
				) : (
					<ul className="divide-y divide-base-300 -mx-1">
						{items.map((n) => {
							const Icon = ICONS[n.type] ?? Bell;
							return (
								<li key={n.id} className={cn("flex gap-3 px-1 py-3", !n.read_at && "bg-primary/5")}>
									<span className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-base-200 text-base-content/60 flex items-center justify-center">
										<Icon className="w-4 h-4" />
									</span>
									<div className="min-w-0">
										<p className="text-sm font-semibold text-base-content">{n.title}</p>
										{n.body && <p className="text-sm text-base-content/60">{n.body}</p>}
										<p className="text-xs text-base-content/50 mt-0.5">{timeAgo(n.created_at)}</p>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</Sheet>
		</>
	);
}
