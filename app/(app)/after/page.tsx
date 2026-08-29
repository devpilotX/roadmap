import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { AfterScreen } from './AfterScreen';

export const metadata: Metadata = { title: 'After January 2027' };
export const dynamic = 'force-dynamic';

export default function AfterPage() {
  return (
    <PageShell title="After January 2027" wide={false} path="/after">
      <PageHead
        title="After January 2027"
        lede="Gate 4 is not the finish line. It is where the plan changes shape."
      />
      <div className="stack-lg">
        <AfterScreen />
      </div>
    </PageShell>
  );
}
