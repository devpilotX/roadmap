import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { WeeksScreen } from './WeeksScreen';

export const metadata: Metadata = { title: 'The 21 weeks' };
export const dynamic = 'force-dynamic';

export default function WeeksPage() {
  return (
    <PageShell title="The 21 weeks" wide path="/weeks">
      <PageHead
        title="The 21 weeks"
        lede="Six phases, twenty one weeks, four gates."
      />
      <div className="stack-lg">
        <WeeksScreen />
      </div>
    </PageShell>
  );
}
