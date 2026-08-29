import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { MoneyScreen } from './MoneyScreen';

export const metadata: Metadata = { title: 'Money hour' };
export const dynamic = 'force-dynamic';

export default function MoneyPage() {
  return (
    <PageShell title="Money hour" wide path="/money">
      <PageHead
        title="Money hour"
        lede="17:00 to 18:00, six days a week, on top of the eight. Never inside them."
      />
      <div className="stack-lg">
        <MoneyScreen />
      </div>
    </PageShell>
  );
}
