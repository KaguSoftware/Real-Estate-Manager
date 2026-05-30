/** Tiny className combiner — joins truthy class strings with a space.
 *  No dependency on clsx/tailwind-merge; later classes simply win via source order. */
export function cn(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(" ");
}
