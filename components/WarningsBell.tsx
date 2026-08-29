'use client';

/**
 * WarningsBell | W1 to W10, refreshed every five minutes.
 *
 * Red cannot be dismissed. Orange can be snoozed for 24 hours, once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

export interface Warning {
  code: string;
  level: 'red' | 'orange';
  title: string;
  message: string;
  can_snooze?: boolean;
  is_permanent?: boolean;
}

const RED_ICON = 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01';
const ORANGE_ICON = 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z';

export interface WarningsBellProps {
  open: boolean;
  onClose: () => void;
  onCount: (n: number) => void;
}

export function WarningsBell({ open, onClose, onCount }: WarningsBellProps) {
  const { toastError } = useToast();
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ warnings: Warning[] }>('/api/warnings');
      setWarnings(data.warnings ?? []);
      setFailed(false);
      onCount((data.warnings ?? []).length);
      // Screens that show the same warnings listen for this.
      document.dispatchEvent(
        new CustomEvent('warnings:loaded', { detail: data.warnings ?? [] })
      );
    } catch {
      setFailed(true);
    }
  }, [onCount]);

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(handle);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    // Focus moves into the dialog, as it did in the Express build. Without this the
    // focus ring stays on the bell, outside an aria-modal panel that is rendered
    // last in the tree, so reaching the contents means tabbing through the page.
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function snooze(code: string) {
    setBusy(code);
    try {
      await api.post(`/api/warnings/${code}/snooze`, {});
      await load();
    } catch (err) {
      toastError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="modal"
      data-open={open ? '1' : '0'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bell-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__panel">
        <div className="between">
          <h2 id="bell-title" className="card__title">
            Active warnings
          </h2>
          <button ref={closeRef} type="button" className="iconbtn" aria-label="Close warnings" onClick={onClose}>
            <Icon path="M6 6l12 12M18 6 6 18" />
          </button>
        </div>

        <div className="stack-sm">
          {failed ? (
            <p className="muted">Warnings could not be loaded.</p>
          ) : warnings === null ? (
            <p className="muted">Checking.</p>
          ) : warnings.length === 0 ? (
            <p className="muted">Nothing is wrong right now. Keep the day moving.</p>
          ) : (
            warnings.map((w) => (
              <div
                key={w.code}
                className={`callout ${w.level === 'red' ? 'callout--red' : 'callout--orange'}`}
              >
                <Icon
                  path={w.level === 'red' ? RED_ICON : ORANGE_ICON}
                  className="callout__icon"
                />
                <div className="callout__body">
                  <p className="callout__title">
                    {w.code} {w.title}
                  </p>
                  <p>{w.message}</p>
                  {w.level === 'orange' && w.can_snooze ? (
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={busy === w.code}
                      onClick={() => void snooze(w.code)}
                    >
                      Snooze 24 h
                    </button>
                  ) : w.level === 'red' ? (
                    <p className="text-xs">Red cannot be dismissed.</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs muted">
          Red warnings cannot be dismissed. An orange warning can be snoozed for 24 hours, once.
        </p>
      </div>
    </div>
  );
}

export default WarningsBell;
