import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageShell } from '@/components/PageShell';
import { LoadingCard, PageHead } from '@/components/ui/Basics';
import { CalendarScreen } from './CalendarScreen';

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  return (
    <PageShell title="Calendar" wide path="/calendar">
      <PageHead
        title="Calendar"
        lede="Every day, every task, one click from the material."
      />
      <div className="stack-lg">
        {/* useSearchParams reads ?date= and ?view=, so the screen is suspended. */}
        <Suspense fallback={<LoadingCard text="Loading calendar controls." />}>
          <CalendarScreen />
        </Suspense>
      </div>
    </PageShell>
  );
}
