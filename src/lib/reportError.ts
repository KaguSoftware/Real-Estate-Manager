/**
 * Single error-reporting choke point. `humanizeError` calls this for unexpected
 * failures, so all error tracking flows through here.
 *
 * Sentry is initialised by sentry.server.config.ts / instrumentation-client.ts
 * (DSN baked in there by the setup wizard), so we just forward to it. In dev we
 * also log to the console for visibility.
 */

import * as Sentry from "@sentry/nextjs";

/** Fire-and-forget: never throws, never blocks the caller. */
export function reportError(e: unknown): void {
	if (process.env.NODE_ENV !== "production") {
		console.error("[reportError]", e);
	}
	try {
		Sentry.captureException(e);
	} catch {
		// Reporting must never break the app.
	}
}
