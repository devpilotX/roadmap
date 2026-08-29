'use client';

/**
 * TimerProvider | the study session timer.
 *
 * Behaviour required by build prompt section 8:
 *   - Open and start opens the link in a new tab, marks the resource reading,
 *     starts a session, and shows a persistent chip with block, elapsed and stop.
 *   - The chip survives a page navigation, because the running session lives on
 *     the server and its id is kept in sessionStorage.
 *   - If the tab is closed without stopping, the server closes the session at
 *     the end of the block window and flags it auto_closed. Minutes are never
 *     silently inflated.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '@/lib/client/api';
import { minutesLabel } from '@/lib/client/format';
import { useToast } from './ToastProvider';

const KEY = 'roadmap.session';

export interface TimerState {
  id: number;
  block: string;
  startedAtMs: number;
  label: string;
}

interface StartArgs {
  block: string;
  resourceId?: number | null;
  weekLinkId?: number | null;
  label?: string;
}

interface OpenArgs extends StartArgs {
  url: string;
}

interface TimerApi {
  session: TimerState | null;
  /** Whole minutes elapsed, recomputed every fifteen seconds. */
  elapsed: number;
  startSession: (args: StartArgs) => Promise<unknown | null>;
  stopSession: () => Promise<unknown | null>;
  openAndStart: (args: OpenArgs) => Promise<unknown | null>;
}

const TimerContext = createContext<TimerApi | null>(null);

export function useTimer(): TimerApi {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside a TimerProvider.');
  return ctx;
}

function load(): TimerState | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

function save(state: TimerState | null): void {
  try {
    if (state) window.sessionStorage.setItem(KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // A browser with storage disabled still gets a working timer for this page.
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { toast, toastError } = useToast();
  const [session, setSession] = useState<TimerState | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Restore the chip after a navigation, then reconcile with the server: if it
  // closed the session while the tab was away, drop the local chip rather than
  // showing a timer that is counting nothing.
  useEffect(() => {
    const restored = load();
    if (!restored) return;
    setSession(restored);
    api
      .get<{ id: number } | null>('/api/sessions/open')
      .then((open) => {
        if (!open || open.id !== restored.id) {
          save(null);
          setSession(null);
        }
      })
      .catch(() => {
        // Offline. Keep the chip; the server will close the session if needed.
      });
  }, []);

  useEffect(() => {
    if (!session) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - session.startedAtMs) / 60000));
    tick();
    const handle = setInterval(tick, 15000);
    return () => clearInterval(handle);
  }, [session]);

  const startSession = useCallback(
    async ({ block, resourceId = null, weekLinkId = null, label = '' }: StartArgs) => {
      if (load()) {
        toast(`A ${load()!.block} session is already running. Stop it first.`, 'warn');
        return null;
      }
      try {
        const data = await api.post<{ id: number; block: string }>('/api/sessions/start', {
          block,
          resource_id: resourceId,
          week_link_id: weekLinkId,
        });
        const next: TimerState = {
          id: data.id,
          block: data.block,
          startedAtMs: Date.now(),
          label,
        };
        save(next);
        setSession(next);
        toast(`${data.block} session started.${label ? ` ${label}` : ''}`, 'ok');
        return data;
      } catch (err) {
        toastError((err as ApiError).message);
        return null;
      }
    },
    [toast, toastError]
  );

  const stopSession = useCallback(async () => {
    const state = load();
    if (!state) return null;
    try {
      const data = await api.post<{ minutes: number }>(`/api/sessions/${state.id}/stop`, {});
      save(null);
      setSession(null);
      toast(`${state.block} session logged: ${minutesLabel(data.minutes)}.`, 'ok');
      // Screens that show minutes listen for this and refetch.
      document.dispatchEvent(new CustomEvent('timer:stopped', { detail: data }));
      return data;
    } catch (err) {
      toastError((err as ApiError).message);
      return null;
    }
  }, [toast, toastError]);

  const openAndStart = useCallback(
    async ({ url, block, resourceId = null, weekLinkId = null, label = '' }: OpenArgs) => {
      // The tab is opened first, inside the click gesture, so the popup blocker
      // does not eat it while an await is pending.
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) toast('The browser blocked the new tab. Allow pop-ups for this site.', 'warn');

      try {
        await api.post('/api/resources/open', {
          resource_id: resourceId,
          week_link_id: weekLinkId,
        });
      } catch (err) {
        toastError(`The link opened but its status did not save: ${(err as ApiError).message}`);
      }
      return startSession({ block, resourceId, weekLinkId, label });
    },
    [startSession, toast, toastError]
  );

  const api2 = useMemo<TimerApi>(
    () => ({ session, elapsed, startSession, stopSession, openAndStart }),
    [session, elapsed, startSession, stopSession, openAndStart]
  );

  return (
    <TimerContext.Provider value={api2}>
      {children}
      <div className="timerchip" data-running={session ? '1' : '0'}>
        <span className="timerchip__pulse" aria-hidden="true" />
        <span className="timerchip__block">{session?.block ?? 'DSA'}</span>
        <span className="timerchip__time">{minutesLabel(elapsed)}</span>
        <button type="button" className="btn btn--sm" onClick={() => void stopSession()}>
          Stop
        </button>
      </div>
    </TimerContext.Provider>
  );
}
