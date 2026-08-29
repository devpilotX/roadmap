import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { todayInTz } from '@/lib/dates';
import { WeekDetailScreen } from './WeekDetailScreen';

export const metadata: Metadata = { title: 'Week' };
export const dynamic = 'force-dynamic';

export default async function WeekDetailPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;

  // The roadmap has 21 weeks. Anything else is not a week, so it is not a page.
  if (!/^\d+$/.test(n)) notFound();
  const week = Number(n);
  if (!Number.isInteger(week) || week < 1 || week > 21) notFound();

  return (
    <PageShell title={`Week ${week}`} wide={false} path={`/weeks/${week}`}>
      <PageHead
        title="Week"
        lede="Focus, learn, build, the six days, ships, the trap, the note, and every link."
      />
      <div className="stack-lg">
        <WeekDetailScreen n={week} today={todayInTz()} />
      </div>
    </PageShell>
  );
}
