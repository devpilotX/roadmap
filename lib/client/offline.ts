'use client';

/**
 * offline.ts | the write queue.
 *
 * Power cuts and patchy connections are normal where this is used, so a tick
 * made offline must not be lost. Writes go to IndexedDB and replay in order when
 * the connection returns. The pending count is always visible.
 */

const DB_NAME = 'roadmap-tracker';
const DB_VERSION = 1;
const STORE = 'writes';

export interface QueuedWrite {
  id?: number;
  method: string;
  path: string;
  body?: unknown;
  at?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('This browser has no IndexedDB, so offline ticks cannot be saved.'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result: IDBRequest<T> | void;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        t.oncomplete = () =>
          resolve((result && 'result' in result ? result.result : undefined) as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export function isQueueable(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export async function queueWrite(entry: QueuedWrite): Promise<void> {
  try {
    await tx('readwrite', (store) => store.add({ ...entry, at: Date.now() }));
    notifyCount();
  } catch {
    // If IndexedDB is unavailable there is nothing more this layer can do. The
    // caller has already been told the write did not land.
  }
}

export async function pendingCount(): Promise<number> {
  try {
    return await tx<number>('readonly', (store) => store.count());
  } catch {
    return 0;
  }
}

async function allPending(): Promise<QueuedWrite[]> {
  try {
    return (await tx<QueuedWrite[]>('readonly', (store) => store.getAll())) ?? [];
  } catch {
    return [];
  }
}

async function removeEntry(id: number): Promise<void> {
  try {
    await tx('readwrite', (store) => store.delete(id));
  } catch {
    // Ignored: a queue entry that cannot be deleted will be retried and skipped.
  }
}

const listeners = new Set<(n: number) => void>();

export function onQueueChange(fn: (n: number) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function notifyCount(): Promise<void> {
  const n = await pendingCount();
  for (const fn of listeners) fn(n);
}

let flushing = false;

export interface FlushResult {
  sent: number;
  failed: number;
  left: number;
}

/**
 * Replays every queued write, oldest first. Stops at the first network failure
 * so ordering is preserved. A write the server rejects on its merits is dropped
 * from the queue and reported, because retrying it forever would never succeed.
 */
export async function flushQueue({
  onReport,
}: { onReport?: (err: { message: string; status?: number }) => void } = {}): Promise<FlushResult> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { sent: 0, failed: 0, left: await pendingCount() };
  }
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const entries = (await allPending()).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const { api } = await import('./api');
    for (const entry of entries) {
      try {
        await api.raw(entry.method, entry.path, entry.body);
        if (entry.id !== undefined) await removeEntry(entry.id);
        sent += 1;
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500) {
          // The server said no on the merits. Keeping it would block the queue.
          if (entry.id !== undefined) await removeEntry(entry.id);
          failed += 1;
          if (onReport) onReport(err as { message: string; status?: number });
        } else {
          break; // still offline, or the server is down. Try again later.
        }
      }
    }
  } finally {
    flushing = false;
    await notifyCount();
  }
  return { sent, failed, left: await pendingCount() };
}

export async function clearQueue(): Promise<void> {
  await tx('readwrite', (store) => store.clear());
  await notifyCount();
}
