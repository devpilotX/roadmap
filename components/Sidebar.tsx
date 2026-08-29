'use client';

/**
 * Sidebar | six groups, in the order given in build prompt section 15.
 *
 * Under 768px this is hidden and the bottom bar takes over, because that is how
 * the daily checkboxes will actually be ticked.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NAV, isActive } from '@/lib/nav';
import { api } from '@/lib/client/api';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';
import { ThemeToggle } from './ThemeToggle';

export interface SidebarProps {
  user: { display_name: string; email: string } | null;
  warningCount: number;
  lastSyncedAt: string;
}

export function Sidebar({ user, warningCount, lastSyncedAt }: SidebarProps) {
  const pathname = usePathname() ?? '/';
  const { toastError } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post('/api/auth/logout', {});
    } catch (err) {
      // The cookie is cleared server side either way; say so rather than hang.
      toastError((err as Error).message);
    } finally {
      // A full navigation, so every cached server component is dropped.
      window.location.href = '/login';
    }
  }

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link className="sidebar__brand" href="/">
        <span className="sidebar__mark" aria-hidden="true">
          RT
        </span>
        <span>
          <span className="sidebar__title">The Roadmap Tracker</span>
          <span className="sidebar__sub">28 Aug 2026 to 24 Jan 2027</span>
        </span>
      </Link>

      <nav className="sidebar__nav">
        {NAV.map((group) => (
          <div className="navgroup" key={group.group}>
            <h2 className="navgroup__label">{group.group}</h2>
            <ul className="navgroup__list">
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      className="navlink"
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon path={item.icon} className="navlink__icon" />
                      <span>{item.label}</span>
                      {item.href === '/' && warningCount > 0 ? (
                        <span
                          className="navlink__badge"
                          aria-label={`${warningCount} active warnings`}
                        >
                          {warningCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        {user ? (
          <div className="row-tight text-sm">
            <span className="truncate" title={user.email}>
              {user.display_name}
            </span>
          </div>
        ) : null}

        <div className="row">
          <ThemeToggle />
          {user ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void signOut()}
              disabled={signingOut}
            >
              Sign out
            </button>
          ) : null}
        </div>

        <p className="text-xs muted">
          {lastSyncedAt ? `Last synced: ${lastSyncedAt}` : 'Last synced: never'}
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
