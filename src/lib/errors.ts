// Map raw Supabase/Postgres errors to messages a non-technical user can act on.

interface PgLikeError {
	code?: string;
	message?: string;
}

export function humanizeError(e: unknown): string {
	const err = (typeof e === "object" && e !== null ? e : {}) as PgLikeError;
	const raw = err.message ?? (e instanceof Error ? e.message : String(e));

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

	if (/JWT|token|not authenticated/i.test(raw)) return "Your session expired — please sign in again.";
	if (/Failed to fetch|NetworkError|fetch failed/i.test(raw))
		return "Couldn't reach the server. Check your connection and try again.";
	if (/row-level security/i.test(raw)) return "You don't have permission to do that.";

	return raw || "Something went wrong. Please try again.";
}
