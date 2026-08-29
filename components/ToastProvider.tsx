'use client';

/**
 * ToastProvider | short lived messages, announced to assistive technology.
 *
 * An error toast stays until it is dismissed, because a failed tick is the one
 * thing in this application that must not disappear quietly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

export type ToastKind = 'ok' | 'info' | 'warn' | 'error';

const HOLD: Record<ToastKind, number> = { ok: 2600, info: 3200, warn: 5200, error: 0 };

const ICONS: Record<ToastKind, string> = {
  ok: 'M4 12l5 5L20 6',
  info: 'M12 8h.01M11 12h1v5h1',
  warn: 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 9l6 6M15 9l-6 6',
};

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  toastOk: (message: string) => void;
  toastWarn: (message: string) => void;
  toastError: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((list) => [...list, { id, message, kind }]);
      const hold = HOLD[kind] ?? 3000;
      if (hold > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), hold)
        );
      }
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      for (const handle of timers.current.values()) clearTimeout(handle);
      timers.current.clear();
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      toastOk: (m: string) => toast(m, 'ok'),
      toastWarn: (m: string) => toast(m, 'warn'),
      toastError: (m: string) => toast(m, 'error'),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" id="toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <Icon path={ICONS[t.kind]} className="callout__icon" />
            {/* Plain text, never HTML, so nothing user supplied can render as markup. */}
            <div className="toast__body">{t.message}</div>
            <button
              type="button"
              className="iconbtn"
              aria-label="Dismiss this message"
              onClick={() => dismiss(t.id)}
            >
              <Icon path="M6 6l12 12M18 6 6 18" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
