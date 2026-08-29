import 'server-only';

/**
 * PageShell | the server side half of the application chrome.
 *
 * Every authenticated screen wraps itself in this. It loads the four things the
 * chrome needs before the first paint, and hands them to the client shell:
 * the person, their theme, when they last synced, and how many warnings are live.
 *
 * The warning count is best effort. A screen that cannot count warnings is still
 * a screen worth rendering, so a failure here shows zero rather than an error page.
 */

import type { ReactNode } from 'react';
import { requirePageUser } from '@/lib/server/auth';
import { loadSettings } from '@/lib/db/me';
import { warningsFor } from '@/lib/db/warnings';
import { isFakeClock } from '@/lib/config';
import { todayInTz } from '@/lib/dates';
import { AppShell } from './AppShell';

export interface PageShellProps {
  title: string;
  /** Wide screens drop the reading width cap: tables, grids and the calendar. */
  wide?: boolean;
  /** The path to return to after signing in, when the session has expired. */
  path?: string;
  children: ReactNode;
}

export async function PageShell({ title, wide = false, path, children }: PageShellProps) {
  const user = await requirePageUser(path);

  const [settings, warningCount] = await Promise.all([
    loadSettings(user.id).catch(() => null),
    warningsFor(user.id)
      .then((r) => r.warnings.length)
      .catch(() => 0),
  ]);

  return (
    <AppShell
      title={title}
      wide={wide}
      user={{ display_name: user.display_name, email: user.email }}
      initialWarningCount={warningCount}
      lastSyncedAt={settings?.last_synced_at ?? ''}
      isFakeClock={isFakeClock}
      today={todayInTz()}
    >
      {children}
    </AppShell>
  );
}

export default PageShell;
