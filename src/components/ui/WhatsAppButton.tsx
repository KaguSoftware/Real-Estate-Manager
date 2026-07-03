"use client";

import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/src/lib/phone";

/** Small wa.me deep-link icon; renders nothing when the phone is missing or
 *  unparseable. Stops propagation so it works inside clickable rows/cards. */
export function WhatsAppButton({ phone, name }: { phone: string | null | undefined; name?: string }) {
	const url = whatsappUrl(phone);
	if (!url) return null;
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(e) => e.stopPropagation()}
			aria-label={`WhatsApp ${name ?? phone}`}
			title="Open in WhatsApp"
			className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors align-middle"
		>
			<MessageCircle className="w-4 h-4" />
		</a>
	);
}
