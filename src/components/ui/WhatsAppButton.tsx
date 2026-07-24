"use client";

import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/src/lib/phone";

/** Small wa.me deep-link icon; renders nothing when the phone is missing or
 *  unparseable. Stops propagation so it works inside clickable rows/cards.
 *  With `text`, WhatsApp opens with the message prefilled. */
export function WhatsAppButton({
	phone,
	name,
	text,
	onSend,
}: {
	phone: string | null | undefined;
	name?: string;
	/** Prefilled message; omit for a plain "open the chat" link. */
	text?: string | null;
	/** Fired when the link is followed — used to log a `whatsapp` activity. */
	onSend?: () => void;
}) {
	const url = whatsappUrl(phone, text);
	if (!url) return null;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(e) => {
				e.stopPropagation();
				onSend?.();
			}}
			aria-label={`${name ?? phone} ile WhatsApp'ta yaz`}
			title="WhatsApp'ta aç"
			className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-success hover:bg-success/10 transition-colors align-middle"
		>
			<MessageCircle className="w-4 h-4" />
		</a>
	);
}
