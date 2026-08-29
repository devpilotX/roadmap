import type { Metadata, Viewport } from 'next';
import { currentUser } from '@/lib/server/auth';
import { loadSettings } from '@/lib/db/me';
import { ToastProvider } from '@/components/ToastProvider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'The Roadmap Tracker',
    template: '%s | The Roadmap Tracker',
  },
  description:
    'A personal career tracker for the window 28 August 2026 to 24 January 2027. 150 days, 21 weeks, four gates.',
  manifest: '/manifest.webmanifest',
  // A personal tracker has no business in a search index.
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/img/icon.svg', type: 'image/svg+xml' }] },
  applicationName: 'The Roadmap Tracker',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: '#2783DE',
};

/**
 * The theme has to be on <html> before the first paint, otherwise a person who
 * chose light gets a flash of dark. It is read from the database here rather
 * than from localStorage, so the choice follows the account and not the browser.
 */
async function resolveTheme(): Promise<string> {
  try {
    const user = await currentUser();
    if (!user) return 'system';
    const settings = await loadSettings(user.id);
    return settings.theme ?? 'system';
  } catch {
    // No database, no account, or a cold start. System is the safe default.
    return 'system';
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await resolveTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
