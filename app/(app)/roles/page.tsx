import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { RolesScreen } from './RolesScreen';

export const metadata: Metadata = { title: 'The seven roles' };
export const dynamic = 'force-dynamic';

export default function RolesPage() {
  return (
    <PageShell title="The seven roles" wide path="/roles">
      <PageHead
        title="The seven roles"
        lede="Ranked, with the band, the ceiling, what they actually test, where to apply and how to prepare."
      />
      <div className="stack-lg">
        <RolesScreen />
      </div>
    </PageShell>
  );
}
