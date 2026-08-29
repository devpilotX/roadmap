import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { DsaScreen } from './DsaScreen';

export const metadata: Metadata = { title: 'DSA tracker' };
export const dynamic = 'force-dynamic';

export default function DsaPage() {
  return (
    <PageShell title="DSA tracker" wide path="/dsa">
      <PageHead
        title="DSA tracker"
        lede="474 problems on the Striver A2Z sheet. 415 of them by 24 January 2027."
      />
      <div className="stack-lg">
        <DsaScreen />
      </div>
    </PageShell>
  );
}
