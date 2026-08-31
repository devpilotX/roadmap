'use client';

/**
 * AppShell | everything that is on every authenticated screen.
 *
 * The sidebar, the top bar, the offline banner, the command palette, the
 * warnings bell and the mobile bottom bar. Nothing screen specific lives here.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import { flushQueue, onQueueChange, pendingCount } from '@/lib/client/offline';
import { Icon } from './Icon';
import { Sidebar } from './Sidebar';
import { BottomBar } from './BottomBar';
import { AccountMenu } from './AccountMenu';
import { CommandPalette } from './CommandPalette';
import { WarningsBell } from './WarningsBell';
import { useToast } from './ToastProvider';

export interface AppShellProps {
  title: string;
  wide?: boolean;
  user: { display_name: string; email: string } | null;
  initialWarningCount: number;
  lastSyncedAt: string;
  isFakeClock: boolean;
  today: string;
  children: ReactNode;
}

export function AppShell({
  title,
  wide = false,
  user,
  initialWarningCount,
  lastSyncedAt,
  isFakeClock,
  today,
  children,
}: AppShellProps) {
  const { toast, toastError } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [warningCount, setWarningCount] = useState(initialWarningCount);
  const [warningLevelRed, setWarningLevelRed] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);

  /* ---- Ctrl K ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ---- the red or orange dot on the bell ---- */
  useEffect(() => {
    const onWarnings = (e: Event) => {
      const list = (e as CustomEvent<{ level: string }[]>).detail ?? [];
      setWarningLevelRed(list.some((w) => w.level === 'red'));
    };
    document.addEventListener('warnings:loaded', onWarnings);
    return () => document.removeEventListener('warnings:loaded', onWarnings);
  }, []);

  /* ---- offline queue and the sync banner ---- */
  const repaint = useCallback(async () => {
    setPending(await pendingCount());
    setOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    const off = onQueueChange((n) => setPending(n));
    void repaint();

    const onOnline = async () => {
      setOnline(true);
      const r = await flushQueue({
        onReport: (err) => toastError(`A queued change was rejected: ${err.message}`),
      });
      if (r.sent) {
        toast(`${r.sent} ${r.sent === 1 ? 'change' : 'changes'} synced.`, 'ok');
        setSyncedAt(new Date().toLocaleString('en-GB'));
        document.dispatchEvent(new CustomEvent('queue:flushed', { detail: r }));
      }
      void repaint();
    };
    const onOffline = () => {
      setOnline(false);
      void repaint();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (navigator.onLine) {
      void flushQueue({
        onReport: (err) => toastError(`A queued change was rejected: ${err.message}`),
      }).then((r) => {
        if (r.sent) {
          toast(`${r.sent} queued ${r.sent === 1 ? 'change' : 'changes'} synced.`, 'ok');
          setSyncedAt(new Date().toLocaleString('en-GB'));
        }
        void repaint();
      });

      // Record a heartbeat so "last synced" means something.
      api
        .post<{ last_synced_at: string }>('/api/me/synced', {})
        .then((d) => setSyncedAt(d.last_synced_at))
        .catch(() => {});
    }

    return () => {
      off();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [repaint, toast, toastError]);

  /* ---- the offline shell ---- */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const { protocol, hostname } = window.location;
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // An offline shell is a bonus, not a requirement.
    });
  }, []);

  const showSync = !online || pending > 0;
  const syncText = !online
    ? pending > 0
      ? `You are offline. ${pending} ${
          pending === 1 ? 'change is' : 'changes are'
        } saved on this device and will sync when you reconnect.`
      : 'You are offline. Ticks are saved on this device and will sync when you reconnect.'
    : `${pending} ${pending === 1 ? 'change is' : 'changes are'} waiting to sync.`;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="app">
        <Sidebar user={user} warningCount={warningCount} lastSyncedAt={syncedAt} />

        <div className="main">
          <header className="topbar">
            <h1 className="topbar__title">{title}</h1>
            <span className="topbar__spacer" />

            {isFakeClock ? (
              <span className="badge badge--orange" title="FAKE_TODAY or FAKE_TIME is set in .env">
                Clock is faked: {today}
              </span>
            ) : null}

            <button
              type="button"
              className="iconbtn"
              aria-label="Open the command palette. Keyboard shortcut Control K"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon path="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4 4" />
            </button>

            <div className="row-tight">
              <button
                type="button"
                className="iconbtn"
                aria-label="Warnings"
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((v) => !v)}
              >
                <Icon path="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16zM10 21a2 2 0 0 0 4 0" />
              </button>
              {warningCount > 0 ? (
                <span className={`badge ${warningLevelRed ? 'badge--red' : 'badge--orange'}`}>
                  {warningCount}
                </span>
              ) : null}
            </div>

            {/* Phone only. The sidebar carries these above 768px, and it is
                hidden below that, which left no way to sign out on a phone. */}
            <AccountMenu user={user} />
          </header>

          <div className="syncbar" data-show={showSync ? '1' : '0'} role="status">
            <Icon
              path="M12 3v10M8 9l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              className="callout__icon"
            />
            <span>{syncText}</span>
          </div>

          <main className={`content${wide ? ' content--wide' : ''}`} id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <BottomBar />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <WarningsBell
        open={bellOpen}
        onClose={() => setBellOpen(false)}
        onCount={setWarningCount}
      />
    </>
  );
}

export default AppShell;
