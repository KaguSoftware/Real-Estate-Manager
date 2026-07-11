// Map raw Supabase/Postgres errors to messages a non-technical user can act on.

import { useAppStore } from "@/src/store";
import { reportError } from "./reportError";

interface PgLikeError {
	code?: string;
	message?: string;
}

/** True when the failure is most plausibly the trial/subscription write lock:
 *  an RLS rejection while the client already knows the team isn't writable. */
function isPaywallError(code: string | undefined, raw: string): boolean {
	const rlsHit = code === "42501" || /row-level security/i.test(raw);
	if (!rlsHit) return false;
	const team = useAppStore.getState().team;
	return team !== null && !team.is_writable;
}

export function humanizeError(e: unknown): string {
	const err = (typeof e === "object" && e !== null ? e : {}) as PgLikeError;
	const raw = err.message ?? (e instanceof Error ? e.message : String(e));

	if (isPaywallError(err.code, raw)) {
		return "Your team's trial has ended — the workspace is read-only until a plan is active. See Billing.";
	}

	switch (err.code) {
		case "23503": // foreign key violation
			return "This record is still linked to other data (for example a lease or payment). Remove those first.";
		case "23505": // unique violation
			if (raw.includes("uniq_active_lease_per_property"))
				return "This property already has an active lease. End it before creating a new one.";
			return "A record with these details already exists.";
		case "23514": // check constraint
			return "One of the values is out of the allowed range. Please review the form.";
		case "42501": // insufficient privilege / RLS
		case "PGRST301":
			return "You don't have permission to do that.";
	}

	// Supabase Auth error strings.
	if (/invalid login credentials/i.test(raw)) return "Wrong email or password. Please try again.";
	if (/email not confirmed/i.test(raw))
		return "Your email isn't confirmed yet — check your inbox for the confirmation link.";
	if (/user already registered/i.test(raw))
		return "An account with this email already exists. Try signing in instead.";
	if (/password should be/i.test(raw))
		return "Password is too weak — use at least 6 characters.";
	if (/rate limit|too many requests|security purposes/i.test(raw))
		return "Too many attempts — please wait a minute and try again.";
	if (/invalid email/i.test(raw)) return "That doesn't look like a valid email address.";

	if (/JWT|token|not authenticated/i.test(raw)) return "Your session expired — please sign in again.";
	if (/Failed to fetch|NetworkError|fetch failed/i.test(raw))
		return "Couldn't reach the server. Check your connection and try again.";
	if (/row-level security/i.test(raw)) return "You don't have permission to do that.";

	// Nothing matched — this is an unexpected failure. Report it (Sentry when
	// configured) before showing the generic fallback so prod breakage surfaces
	// to us, not only to customers.
	reportError(e);
	return raw || "Something went wrong. Please try again.";
}
