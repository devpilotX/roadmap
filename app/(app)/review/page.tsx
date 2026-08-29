import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { ReviewScreen } from './ReviewScreen';

export const metadata: Metadata = { title: 'Saturday review' };
export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  return (
    <PageShell title="Saturday review" path="/review">
      <PageHead title="Saturday review" lede="Seven questions. Written, not thought about." />
      <div className="stack-lg">
        <ReviewScreen />
      </div>
    </PageShell>
  );
}
