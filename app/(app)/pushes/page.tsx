import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { PushesScreen } from './PushesScreen';

export const metadata: Metadata = { title: 'GitHub pushes' };
export const dynamic = 'force-dynamic';

export default function PushesPage() {
  return (
    <PageShell title="GitHub pushes" wide path="/pushes">
      <PageHead
        title="GitHub pushes"
        lede="The one signal a recruiter can verify without talking to you."
      />
      <div className="stack-lg">
        <PushesScreen />
      </div>
    </PageShell>
  );
}
