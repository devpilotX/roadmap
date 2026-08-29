import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { StatsScreen } from './StatsScreen';

export const metadata: Metadata = { title: 'Stats' };
export const dynamic = 'force-dynamic';

export default function StatsPage() {
  return (
    <PageShell title="Stats" wide path="/stats">
      <PageHead title="Stats" lede="Numbers only. No adjectives." />
      <div className="stack-lg">
        <StatsScreen />
      </div>
    </PageShell>
  );
}
