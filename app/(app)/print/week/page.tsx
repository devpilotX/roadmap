import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { LoadingCard, PageHead } from '@/components/ui/Basics';
import { PrintWeekScreen } from './PrintWeekScreen';

export const metadata: Metadata = { title: 'Printable week sheet' };
export const dynamic = 'force-dynamic';

export default function PrintWeekPage() {
  return (
    <PageShell title="Printable week sheet" wide path="/print/week">
      <PageHead
        title="Printable week sheet"
        lede="One clean week per page, for days without power."
      />
      <div className="stack-lg">
        <Suspense fallback={<LoadingCard text="Loading choose a week." />}>
          <PrintWeekScreen />
        </Suspense>
      </div>
    </PageShell>
  );
}
