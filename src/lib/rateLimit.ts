/**
 * Shared fixed-window rate limiter for API routes.
 *
 * Uses Upstash Redis (via its REST API — no SDK dependency) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, so limits hold
 * across all serverless instances. Without those env vars it falls back to a
 * per-instance in-memory counter — correct for local/dev, best-effort in prod
 * until Upstash is provisioned (Vercel Marketplace → Upstash Redis).
 *
 * Fail-open: if Redis is unreachable we allow the request rather than block
 * legitimate traffic on an infra hiccup.
 */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(REST_URL && REST_TOKEN);

// ── in-memory fallback ───────────────────────────────────────────────────────
const buckets = new Map<string, { count: number; reset: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = buckets.get(key);
	if (!entry || entry.reset < now) {
		buckets.set(key, { count: 1, reset: now + windowMs });
		return false;
	}
	entry.count += 1;
	return entry.count > limit;
}

// ── Upstash REST: INCR then EXPIRE on first hit, pipelined ────────────────────
async function redisLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
	const windowSec = Math.ceil(windowMs / 1000);
	try {
		const res = await fetch(`${REST_URL}/pipeline`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${REST_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify([
				["INCR", key],
				["EXPIRE", key, windowSec, "NX"],
			]),
			// Never let the limiter itself hang a request.
			signal: AbortSignal.timeout(1500),
		});
		if (!res.ok) return false; // fail-open
		const out = (await res.json()) as Array<{ result: number }>;
		const count = out[0]?.result ?? 0;
		return count > limit;
	} catch {
		return false; // fail-open on any Redis error
	}
}

/**
 * Returns true when the caller has EXCEEDED the limit and should be rejected.
 * `key` should encode the route + identity, e.g. `invite:<userId>`.
 */
export async function isRateLimited(
	key: string,
	limit: number,
	windowMs: number,
): Promise<boolean> {
	return useRedis ? redisLimit(key, limit, windowMs) : memoryLimit(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
	const xff = req.headers.get("x-forwarded-for");
	if (xff) return xff.split(",")[0]!.trim();
	return req.headers.get("x-real-ip")?.trim() || "unknown";
}
