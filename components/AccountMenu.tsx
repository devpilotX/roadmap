'use client';

/**
 * AccountMenu | the account controls, for a screen with no sidebar.
 *
 * Under 768px the sidebar is `display: none`, and the sidebar was the only place
 * that held the theme toggle and the sign out button. On a phone — which is where
 * the daily ticking actually happens — there was no way to change the theme and no
 * way to sign out at all. This lives in the top bar, which is visible at every
 * width, and CSS hides it at 769px and above where the sidebar already offers both.
 *
 * The popover is `hidden` while closed rather than merely invisible, so a closed
 * menu is out of the accessibility tree and out of the tab order. Escape closes it
 * and returns focus to the button that opened it, a click outside closes it, and
 * Tab cycles inside it while it is open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { signOutEverywhere } from '@/lib/client/signOut';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { useToast } from './ToastProvider';

export interface AccountMenuProps {
  user: { display_name: string; email: string } | null;
}

/** Everything inside `root` that a keyboard can land on. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], select, input, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

export function AccountMenu({ user }: AccountMenuProps) {
  const { toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(
    ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      setOpen(false);
      if (restoreFocus) buttonRef.current?.focus();
    },
    []
  );

  /* ---- focus the panel when it opens ---- */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    focusables(panel)[0]?.focus();
  }, [open]);

  /* ---- Escape, Tab containment, and clicking away ---- */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusables(panel);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      // Focus is not restored: the person is already interacting elsewhere.
      close({ restoreFocus: false });
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  async function signOut() {
    setSigningOut(true);
    await signOutEverywhere(toastError);
  }

  return (
    <div className="acct">
      <button
        ref={buttonRef}
        type="button"
        className="iconbtn acct__btn"
        aria-label="Account and settings"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="acct-panel"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" />
      </button>

      <div
        ref={panelRef}
        id="acct-panel"
        className="acct__panel"
        role="menu"
        aria-label="Account"
        hidden={!open}
      >
        {user ? (
          <div className="acct__who">
            <span className="acct__name">{user.display_name}</span>
            <span className="acct__email">{user.email}</span>
          </div>
        ) : null}

        <div className="acct__row">
          <span className="acct__label">Theme</span>
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="btn btn--ghost acct__signout"
          onClick={signOut}
          disabled={signingOut}
          role="menuitem"
        >
          <Icon path="M15 12H4M8 8l-4 4 4 4M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
          <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );
}

export default AccountMenu;
