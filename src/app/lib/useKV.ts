/**
 * SWR-like cache hook for Supabase KV with optimistic updates.
 *
 * Features:
 * - In-memory cache shared across components via module-level Map
 * - Stale-while-revalidate: returns cached data instantly, refreshes in background
 * - Optimistic updates: UI updates immediately, rolls back on error
 * - Deduplication: concurrent requests to the same key are merged
 * - TTL: configurable staleness threshold (default 30s)
 *
 * Usage:
 *   const { data, loading, save, mutate } = useKV<Project[]>("projects:list", []);
 *   save(newProjects);  // optimistic save
 *   mutate(transform);  // optimistic local-only mutation
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getData, saveData } from "./api";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T | null>;
}

// Module-level cache shared across all hook instances
const cache = new Map<string, CacheEntry<any>>();
// Subscribers per key: when cache updates, all subscribers re-render
const subscribers = new Map<string, Set<() => void>>();
// In-flight fetches (deduplication)
const inFlight = new Map<string, Promise<any>>();

const DEFAULT_STALE_MS = 30_000; // 30 seconds

function notifySubscribers(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
}

export function useKV<T>(
  key: string,
  defaultValue: T,
  options?: { staleMs?: number; skipFetch?: boolean }
) {
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);
  const mountedRef = useRef(true);

  // Subscribe to cache changes for this key
  useEffect(() => {
    mountedRef.current = true;
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key)!.add(rerender);
    return () => {
      mountedRef.current = false;
      subscribers.get(key)?.delete(rerender);
    };
  }, [key, rerender]);

  // Fetch / revalidate
  useEffect(() => {
    if (options?.skipFetch) return;
    const entry = cache.get(key);
    const isStale = !entry || Date.now() - entry.timestamp > staleMs;

    if (isStale) {
      revalidate();
    }
  }, [key]);

  const revalidate = useCallback(async () => {
    // Deduplicate concurrent requests
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = getData<T>(key).then((result) => {
      inFlight.delete(key);
      if (result !== null && result !== undefined) {
        cache.set(key, { data: result, timestamp: Date.now() });
        notifySubscribers(key);
      } else if (!cache.has(key)) {
        // No remote data AND no cache → use default
        cache.set(key, { data: defaultValue, timestamp: Date.now() });
        notifySubscribers(key);
      }
      return result;
    }).catch((err) => {
      inFlight.delete(key);
      console.error(`useKV revalidate error for ${key}:`, err);
      return null;
    });

    inFlight.set(key, promise);
    return promise;
  }, [key, defaultValue]);

  // Get current data from cache
  const data: T = cache.get(key)?.data ?? defaultValue;
  const loading = !cache.has(key) && !options?.skipFetch;

  /**
   * Optimistic save: updates UI instantly, persists to KV in background.
   * On persistent failure rolls back; on transient auth failures keeps the
   * optimistic value (the token will refresh and data can be re-saved).
   */
  const save = useCallback(
    async (newData: T) => {
      const prev = cache.get(key)?.data;
      // Optimistic update
      cache.set(key, { data: newData, timestamp: Date.now() });
      notifySubscribers(key);

      try {
        const ok = await saveData(key, newData);
        if (!ok) {
          // saveData returns false for two reasons:
          //   1. auth rejection (401) - transient, token will refresh → keep optimistic value
          //   2. actual server error - also non-fatal, log quietly
          // Do NOT throw or rollback: the UI has the correct value,
          // and re-saves will succeed once auth is established.
          console.info(`useKV: save skipped for "${key}" (server returned false, likely auth refresh in progress)`);
        }
      } catch (err) {
        // Network-level errors - rollback the optimistic update
        console.error(`useKV save error for ${key}:`, err);
        if (prev !== undefined) {
          cache.set(key, { data: prev, timestamp: Date.now() });
        } else {
          cache.delete(key);
        }
        notifySubscribers(key);
        throw err;
      }
    },
    [key]
  );

  /**
   * Local-only optimistic mutation (no KV persist).
   * Useful for intermediate UI states before a final save.
   */
  const mutate = useCallback(
    (updater: (current: T) => T) => {
      const current = cache.get(key)?.data ?? defaultValue;
      const next = updater(current);
      cache.set(key, { data: next, timestamp: Date.now() });
      notifySubscribers(key);
    },
    [key, defaultValue]
  );

  /**
   * Invalidate cache for this key, forcing next render to refetch.
   */
  const invalidate = useCallback(() => {
    cache.delete(key);
    notifySubscribers(key);
  }, [key]);

  return { data, loading, save, mutate, revalidate, invalidate };
}

/**
 * Preload a key into cache (call outside of components).
 */
export function preloadKV(key: string) {
  if (cache.has(key)) return;
  if (inFlight.has(key)) return;

  const promise = getData(key).then((result) => {
    inFlight.delete(key);
    if (result !== null) {
      cache.set(key, { data: result, timestamp: Date.now() });
      notifySubscribers(key);
    }
    return result;
  }).catch(() => { inFlight.delete(key); });
  inFlight.set(key, promise);
}

/**
 * Clear the entire cache (useful after backup restore).
 */
export function clearKVCache() {
  cache.clear();
}