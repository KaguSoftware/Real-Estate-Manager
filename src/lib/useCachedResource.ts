"use client";

import { useEffect, useRef, useState } from "react";
import { humanizeError } from "./errors";

/**
 * Stale-while-revalidate cache for list/detail fetches.
 *
 * Why: every dashboard previously refetched from Supabase on each mount (i.e.
 * every time you navigated back to the page) and on every filter change, paying
 * network latency + a loading flash even when nothing had changed. This hook
 * serves the last cached value for a key instantly, then revalidates in the
 * background and updates in place only if the data actually changed.
 *
 * The cache is a module-level Map so it survives client-side navigations within
 * a session; entries are also mirrored to sessionStorage ("kagu:cache:*") so a
 * hard reload paints instantly from the last snapshot and revalidates in the
 * background. Call `mutateCache`
 * after a create/update/delete to seed/refresh an entry, or `clearCache` on
 * sign-out so the next user never sees the previous user's rows.
 */

interface Entry<T> {
	data: T;
	/** epoch ms when this entry was last written from a successful fetch */
	fetchedAt: number;
}

// key -> cached entry. Untyped at the boundary; each hook instance owns its T.
const cache = new Map<string, Entry<unknown>>();
// key -> in-flight promise, so concurrent mounts share one network request.
const inflight = new Map<string, Promise<unknown>>();

// ── sessionStorage persistence ───────────────────────────────────────────────
// Entries are mirrored to sessionStorage so a hard reload paints instantly from
// the last snapshot and then revalidates in the background (the hydrated entry
// keeps its original fetchedAt, so it never counts as "fresh" under dedupeMs
// beyond its real age). All storage access is best-effort: SSR, private mode
// and quota errors are swallowed.
const STORAGE_PREFIX = "kagu:cache:";
// Entries can hold large arrays; don't persist anything whose JSON is huge.
const MAX_PERSIST_CHARS = 200_000;
// Keys we've already tried to hydrate (hit or miss) — avoids re-reading and
// re-parsing storage on every render, and stops a deleted Map entry from being
// resurrected out of a stale snapshot after invalidation.
const hydrationAttempted = new Set<string>();

function safeStorage(): Storage | null {
	try {
		if (typeof window === "undefined") return null;
		return window.sessionStorage;
	} catch {
		return null;
	}
}

function persistEntry(key: string, entry: Entry<unknown>) {
	const storage = safeStorage();
	if (!storage) return;
	try {
		const json = JSON.stringify(entry);
		if (json.length > MAX_PERSIST_CHARS) {
			// Too big to persist — drop any older (now stale) snapshot instead.
			storage.removeItem(STORAGE_PREFIX + key);
			return;
		}
		storage.setItem(STORAGE_PREFIX + key, json);
	} catch {
		// Quota exceeded / serialization failure — in-memory cache still works.
	}
}

/** Remove persisted entries whose key matches `matches` (all when omitted). */
function dropPersisted(matches?: (key: string) => boolean) {
	const storage = safeStorage();
	if (!storage) return;
	try {
		const doomed: string[] = [];
		for (let i = 0; i < storage.length; i++) {
			const raw = storage.key(i);
			if (raw == null || !raw.startsWith(STORAGE_PREFIX)) continue;
			const key = raw.slice(STORAGE_PREFIX.length);
			if (!matches || matches(key)) doomed.push(raw);
		}
		for (const raw of doomed) storage.removeItem(raw);
	} catch {
		// best-effort
	}
}

/**
 * Read a cache entry, lazily hydrating it from sessionStorage on first access
 * after a hard reload. Idempotent, so it is safe to call during render.
 */
function getEntry(key: string): Entry<unknown> | undefined {
	const hit = cache.get(key);
	if (hit) return hit;
	if (hydrationAttempted.has(key)) return undefined;
	hydrationAttempted.add(key);
	const storage = safeStorage();
	if (!storage) return undefined;
	try {
		const raw = storage.getItem(STORAGE_PREFIX + key);
		if (!raw) return undefined;
		const parsed: unknown = JSON.parse(raw);
		if (
			parsed !== null &&
			typeof parsed === "object" &&
			"data" in parsed &&
			typeof (parsed as { fetchedAt?: unknown }).fetchedAt === "number"
		) {
			// Keep the snapshot's fetchedAt: a hydrated entry is only "fresh" for
			// dedupe purposes within its real age, so revalidation still happens.
			const entry: Entry<unknown> = {
				data: (parsed as Entry<unknown>).data,
				fetchedAt: (parsed as Entry<unknown>).fetchedAt,
			};
			cache.set(key, entry);
			return entry;
		}
	} catch {
		// corrupt snapshot — ignore
	}
	return undefined;
}

// Mounted hook instances, notified when cache entries are dropped/written so
// they can refetch (their entry vanished) or re-render (it changed). Without
// this, a component whose entry is invalidated while mounted renders null
// forever — its effect never reruns because the key didn't change.
const subscribers = new Set<() => void>();
function notifySubscribers() {
	for (const fn of subscribers) fn();
}

/** Drop everything (e.g. on sign-out), including persisted snapshots. */
export function clearCache() {
	cache.clear();
	inflight.clear();
	hydrationAttempted.clear();
	dropPersisted();
	notifySubscribers();
}

/** Drop a single key, or all keys sharing a prefix (e.g. "properties"). */
export function invalidateCache(keyOrPrefix: string) {
	const matches = (k: string) => k === keyOrPrefix || k.startsWith(`${keyOrPrefix}:`);
	for (const k of cache.keys()) {
		if (matches(k)) cache.delete(k);
	}
	// Also drop persisted snapshots so a reload can't resurrect stale data.
	dropPersisted(matches);
	notifySubscribers();
}

/** Imperatively write a value into the cache (e.g. after a mutation). */
export function mutateCache<T>(key: string, data: T) {
	const entry: Entry<unknown> = { data, fetchedAt: Date.now() };
	cache.set(key, entry);
	hydrationAttempted.add(key); // in-memory value is now authoritative
	persistEntry(key, entry);
	notifySubscribers();
}

export interface CachedResource<T> {
	/** Cached data if present (shown immediately), else null until first fetch resolves. */
	data: T | null;
	/** True only while there is no cached data and a fetch is in flight (initial load). */
	loading: boolean;
	/** True while a background revalidation is running over already-cached data. */
	validating: boolean;
	error: string | null;
	/** Force a refetch now (bypasses the in-flight dedupe of an existing call). */
	refetch: () => void;
}

interface Options {
	/**
	 * Skip fetching entirely (e.g. before the user is known). While disabled the
	 * hook still returns any cached value but never hits the network.
	 */
	enabled?: boolean;
	/**
	 * Don't revalidate if the cached entry is younger than this (ms). 0 = always
	 * revalidate in the background on mount/key-change. Default 0.
	 */
	dedupeMs?: number;
}

/**
 * @param key      Stable string identifying this query (params folded in).
 *                 Pass null to disable (treated like enabled:false).
 * @param fetcher  Returns the data for `key`. Re-created each render is fine;
 *                 it is read through a ref so it never re-triggers the effect.
 * @param onData   Optional side effect for each successful fetch (e.g. write the
 *                 rows into a zustand store so existing tables keep rendering).
 */
export function useCachedResource<T>(
	key: string | null,
	fetcher: () => Promise<T>,
	onData?: (data: T) => void,
	options: Options = {},
): CachedResource<T> {
	const { enabled = true, dedupeMs = 0 } = options;
	const active = enabled && key != null;

	// Displayed value is derived from the live cache during render, so a key change
	// instantly shows that key's cached value with no setState-in-effect. State only
	// tracks async results so a successful background fetch triggers a re-render.
	const cached = key != null ? (getEntry(key) as Entry<T> | undefined) : undefined;
	const [, forceRender] = useState(0);
	const [error, setError] = useState<string | null>(null);
	// True only while a fetch is in flight (whether initial or revalidation).
	const [fetching, setFetching] = useState(false);

	// Keep the latest fetcher/onData without making them effect dependencies.
	// Written in an effect (not during render) per react-hooks/refs.
	const fetcherRef = useRef(fetcher);
	const onDataRef = useRef(onData);
	useEffect(() => {
		fetcherRef.current = fetcher;
		onDataRef.current = onData;
	});

	// Bumped by refetch() to force the effect to run again.
	const [nonce, setNonce] = useState(0);

	// React to external cache invalidation: if our entry was dropped, refetch;
	// if it was rewritten (mutateCache), just re-render to show the new value.
	const keyRef = useRef(key);
	const activeRef = useRef(active);
	useEffect(() => {
		keyRef.current = key;
		activeRef.current = active;
	});
	useEffect(() => {
		const onCacheChange = () => {
			const k = keyRef.current;
			if (k == null) return;
			if (getEntry(k) == null && activeRef.current) setNonce((n) => n + 1);
			else forceRender((n) => n + 1);
		};
		subscribers.add(onCacheChange);
		return () => { subscribers.delete(onCacheChange); };
	}, []);

	useEffect(() => {
		if (!active || key == null) return;
		let cancelled = false;

		const existing = getEntry(key) as Entry<T> | undefined;
		// Within the dedupe window a cached entry is considered fresh — skip the
		// network entirely (only an explicit refetch via nonce overrides this).
		if (existing && dedupeMs > 0 && Date.now() - existing.fetchedAt < dedupeMs && nonce === 0) {
			return;
		}

		// Share a single in-flight request across concurrent mounts of the same key.
		let promise = inflight.get(key) as Promise<T> | undefined;
		if (!promise || nonce > 0) {
			promise = fetcherRef.current();
			inflight.set(key, promise);
		}

		// Flag the in-flight fetch without a synchronous setState in the effect body.
		queueMicrotask(() => {
			if (!cancelled) {
				setFetching(true);
				setError(null);
			}
		});

		promise
			.then((result) => {
				const entry: Entry<unknown> = { data: result, fetchedAt: Date.now() };
				cache.set(key, entry);
				hydrationAttempted.add(key);
				persistEntry(key, entry);
				onDataRef.current?.(result);
				if (!cancelled) forceRender((n) => n + 1);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(humanizeError(e));
			})
			.finally(() => {
				if (inflight.get(key) === promise) inflight.delete(key);
				if (!cancelled) setFetching(false);
			});

		return () => {
			cancelled = true;
		};
		// `key` already encodes the query params; fetcher/onData are read via refs.
	}, [key, active, dedupeMs, nonce]);

	const data = cached ? cached.data : null;
	return {
		data,
		// "loading" = the blocking initial load (no cached data yet to show).
		loading: active && !cached && fetching,
		// "validating" = refreshing in the background over already-cached data.
		validating: !!cached && fetching,
		error,
		refetch: () => setNonce((n) => n + 1),
	};
}
