'use client';

/**
 * useResource | load, show, refresh.
 *
 * Every screen in this application does the same three things: fetch one JSON
 * payload, render it, and refetch after a write. This is that, once, so no screen
 * has to invent its own loading state and none of them can forget the error case.
 *
 * A failure is never a blank panel. `error` carries a message written to be shown
 * to a person, straight from the server.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Refetch without clearing what is already on screen. */
  refresh: () => Promise<void>;
  /** Replace the payload locally, for an optimistic tick. */
  setData: (next: T | null | ((prev: T | null) => T | null)) => void;
}

export function useResource<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against a slow response for an old path landing after a new one.
  const latest = useRef(0);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!path) {
        setLoading(false);
        return;
      }
      const ticket = latest.current + 1;
      latest.current = ticket;
      if (showSpinner) setLoading(true);
      try {
        const next = await api.get<T>(path);
        if (latest.current !== ticket) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (latest.current !== ticket) return;
        setError((err as ApiError).message);
      } finally {
        if (latest.current === ticket) setLoading(false);
      }
    },
    [path]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(false);
  }, [load]);

  return { data, error, loading, refresh, setData };
}

/**
 * A write that shows its result immediately and undoes itself if the server
 * refuses. Nothing is ever left looking saved when it was not.
 */
export async function optimistic<T>({
  apply,
  revert,
  write,
  onError,
}: {
  apply: () => void;
  revert: () => void;
  write: () => Promise<T>;
  onError?: (err: ApiError) => void;
}): Promise<T | null> {
  apply();
  try {
    return await write();
  } catch (err) {
    revert();
    if (onError) onError(err as ApiError);
    return null;
  }
}

/** Debounce, for search boxes and note fields. */
export function useDebounced<A extends unknown[]>(
  fn: (...args: A) => void,
  ms = 250
): (...args: A) => void {
  const handle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFn = useRef(fn);
  latestFn.current = fn;

  useEffect(
    () => () => {
      if (handle.current) clearTimeout(handle.current);
    },
    []
  );

  return useCallback(
    (...args: A) => {
      if (handle.current) clearTimeout(handle.current);
      handle.current = setTimeout(() => latestFn.current(...args), ms);
    },
    [ms]
  );
}
