import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { ApplicationsScreen } from './ApplicationsScreen';

export const metadata: Metadata = { title: 'Applications' };
export const dynamic = 'force-dynamic';

export default function ApplicationsPage() {
  return (
    <PageShell title="Applications" wide path="/applications">
      <PageHead title="Applications" lede="One hundred is the floor, not the target." />
      <div className="stack-lg">
        <ApplicationsScreen />
      </div>
    </PageShell>
  );
}
