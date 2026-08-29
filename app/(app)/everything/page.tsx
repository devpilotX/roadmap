import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { EverythingScreen } from './EverythingScreen';

export const metadata: Metadata = { title: 'Everything A to Z' };
export const dynamic = 'force-dynamic';

export default function EverythingPage() {
  return (
    <PageShell title="Everything A to Z" wide path="/everything">
      <PageHead
        title="Everything A to Z"
        lede="Every trackable item in the roadmap, in one list."
      />
      <div className="stack-lg">
        <EverythingScreen />
      </div>
    </PageShell>
  );
}
