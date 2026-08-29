import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { EligibilityScreen } from './EligibilityScreen';

export const metadata: Metadata = { title: 'Eligibility' };
export const dynamic = 'force-dynamic';

export default function EligibilityPage() {
  return (
    <PageShell title="Eligibility" wide path="/eligibility">
      <PageHead title="Eligibility" lede="What can I apply for today." />
      <div className="stack-lg">
        <EligibilityScreen />
      </div>
    </PageShell>
  );
}
