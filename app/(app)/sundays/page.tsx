import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { SundaysScreen } from './SundaysScreen';

export const metadata: Metadata = { title: 'Sundays' };
export const dynamic = 'force-dynamic';

export default function SundaysPage() {
  return (
    <PageShell title="Sundays" wide={false} path="/sundays">
      <PageHead
        title="Sundays"
        lede="Ten working, four gate audits, seven rest. Rest is load bearing."
      />
      <div className="stack-lg">
        <SundaysScreen />
      </div>
    </PageShell>
  );
}
