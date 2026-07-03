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
 * a session but is naturally dropped on a full page reload. Call `mutateCache`
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

// Mounted hook instances, notified when cache entries are dropped/written so
// they can refetch (their entry vanished) or re-render (it changed). Without
// this, a component whose entry is invalidated while mounted renders null
// forever — its effect never reruns because the key didn't change.
const subscribers = new Set<() => void>();
function notifySubscribers() {
	for (const fn of subscribers) fn();
}

/** Drop everything (e.g. on sign-out). */
export function clearCache() {
	cache.clear();
	inflight.clear();
	notifySubscribers();
}

/** Drop a single key, or all keys sharing a prefix (e.g. "properties"). */
export function invalidateCache(keyOrPrefix: string) {
	for (const k of cache.keys()) {
		if (k === keyOrPrefix || k.startsWith(`${keyOrPrefix}:`)) cache.delete(k);
	}
	notifySubscribers();
}

/** Imperatively write a value into the cache (e.g. after a mutation). */
export function mutateCache<T>(key: string, data: T) {
	cache.set(key, { data, fetchedAt: Date.now() });
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
	const cached = key != null ? (cache.get(key) as Entry<T> | undefined) : undefined;
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
			if (!cache.has(k) && activeRef.current) setNonce((n) => n + 1);
			else forceRender((n) => n + 1);
		};
		subscribers.add(onCacheChange);
		return () => { subscribers.delete(onCacheChange); };
	}, []);

	useEffect(() => {
		if (!active || key == null) return;
		let cancelled = false;

		const existing = cache.get(key) as Entry<T> | undefined;
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
				cache.set(key, { data: result, fetchedAt: Date.now() });
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
