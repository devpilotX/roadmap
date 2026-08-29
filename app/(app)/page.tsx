import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { longDate, todayInTz } from '@/lib/dates';
import { TodayScreen } from './TodayScreen';

export const metadata: Metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

/**
 * Today.
 *
 * The page head is the one on this screen that the client owns, because its
 * title is the date and its lede is the week line, and the old script replaced
 * both from /api/today on every draw. The server still renders the date first,
 * exactly as the EJS template did with todayLong, so the heading is never blank
 * on the first paint.
 */
export default function TodayPage() {
  return (
    <PageShell title="Today" path="/">
      <div className="stack-lg">
        <TodayScreen todayLong={longDate(todayInTz())} />
      </div>
    </PageShell>
  );
}
