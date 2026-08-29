'use client';

/**
 * ThemeToggle | system, light, dark, in that order.
 *
 * The theme is applied to <html data-theme> immediately so the change is
 * instant, then saved. A failed save still leaves the theme changed for this
 * session, and says so rather than pretending it was remembered.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export function ThemeToggle() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<Theme>('system');

  // Read what the server already rendered onto <html>, so the button label
  // matches the page on first paint.
  useEffect(() => {
    const current = document.documentElement.dataset.theme ?? 'system';
    setTheme(isTheme(current) ? current : 'system');
  }, []);

  async function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      await api.patch('/api/me/settings', { theme: next });
    } catch (err) {
      toast(`Theme changed, but not saved: ${(err as Error).message}`, 'warn');
    }
  }

  return (
    <button
      type="button"
      className="btn btn--sm btn--ghost"
      aria-label="Change colour theme"
      onClick={() => void cycle()}
    >
      <Icon path="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <span>{LABEL[theme]}</span>
    </button>
  );
}

export default ThemeToggle;
