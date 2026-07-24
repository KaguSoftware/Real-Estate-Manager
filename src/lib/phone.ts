// Phone normalization for wa.me deep links. WhatsApp wants digits only with a
// country code; Turkish numbers written as 0XXX… get the 90 prefix.

export function whatsappUrl(
	phone: string | null | undefined,
	/** Optional prefilled message. Omit for a plain "open the chat" link. */
	text?: string | null,
): string | null {
	if (!phone) return null;
	let digits = phone.replace(/\D/g, "");
	if (!digits) return null;
	if (digits.startsWith("00")) digits = digits.slice(2);
	else if (digits.startsWith("0")) digits = "90" + digits.slice(1);
	// 10-digit numbers without any prefix are assumed Turkish mobiles (5XX…).
	else if (digits.length === 10 && digits.startsWith("5")) digits = "90" + digits;
	if (digits.length < 10) return null;
	const base = `https://wa.me/${digits}`;
	// No text = the exact URL this function has always returned, so existing
	// callers are unaffected.
	const message = text?.trim();
	return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
