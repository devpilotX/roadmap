import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { LadderScreen } from './LadderScreen';

export const metadata: Metadata = { title: 'Unlock ladder' };
export const dynamic = 'force-dynamic';

export default function LadderPage() {
  return (
    <PageShell title="Unlock ladder" wide={false} path="/ladder">
      <PageHead title="Unlock ladder" lede="What each milestone actually qualifies you for." />
      <div className="stack-lg">
        <LadderScreen />
      </div>
    </PageShell>
  );
}
