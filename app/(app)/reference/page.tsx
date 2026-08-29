import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { LoadingCard, PageHead } from '@/components/ui/Basics';
import { getVerificationLog } from '@/lib/db/reference';
import { renderMarkdown } from '@/lib/markdown';
import { ReferenceScreen } from './ReferenceScreen';

export const metadata: Metadata = { title: 'Reference' };
export const dynamic = 'force-dynamic';

export default async function ReferencePage() {
  // Appendix G is a record, not seed data. It is read from data/final.md when the
  // page is requested and rendered here, exactly as the Express build did.
  // renderMarkdown escapes all HTML before it applies any rule, so this is safe.
  const log = await getVerificationLog();
  const verificationLogHtml = log.found ? renderMarkdown(log.markdown) : '';

  return (
    <PageShell title="Reference" wide path="/reference">
      <PageHead
        title="Reference"
        lede="The corrections, the pins, the skip list, and the verification log."
      />
      <div className="stack-lg">
        <Suspense fallback={<LoadingCard text="Loading jump to." />}>
          <ReferenceScreen
            verificationLogHtml={verificationLogHtml}
            verificationLogFound={log.found}
          />
        </Suspense>
      </div>
    </PageShell>
  );
}
