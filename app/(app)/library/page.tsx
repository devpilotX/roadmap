import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { LibraryScreen } from './LibraryScreen';

export const metadata: Metadata = { title: 'Resource library' };
export const dynamic = 'force-dynamic';

export default function LibraryPage() {
  return (
    <PageShell title="Resource library" wide path="/library">
      <PageHead
        title="Resource library"
        lede="Every link in Part 7, all twenty categories, each one tickable."
      />
      <div className="stack-lg">
        <LibraryScreen />
      </div>
    </PageShell>
  );
}
