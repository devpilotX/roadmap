import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { GatesScreen } from './GatesScreen';

export const metadata: Metadata = { title: 'Gates' };
export const dynamic = 'force-dynamic';

export default function GatesPage() {
  return (
    <PageShell title="Gates" wide path="/gates">
      <PageHead
        title="Gates"
        lede="Four gates and four money gates. A gate is not a checkpoint you hope to reach."
      />
      <div className="stack-lg">
        <GatesScreen />
      </div>
    </PageShell>
  );
}
