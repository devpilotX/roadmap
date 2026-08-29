import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { getVerificationLog } from '@/lib/db/reference';
import { renderMarkdown } from '@/lib/markdown';
import { NewZealandScreen } from './NewZealandScreen';

export const metadata: Metadata = { title: 'New Zealand' };
export const dynamic = 'force-dynamic';

export default async function NewZealandPage() {
  // Appendix G is rendered read only, straight from data/final.md. It is never
  // parsed into rows and never seeded, because final.md says so. renderMarkdown
  // escapes every character of HTML before it applies a single rule.
  const log = await getVerificationLog();

  return (
    <PageShell title="New Zealand" wide path="/newzealand">
      <PageHead
        title="New Zealand"
        lede="Software Engineer 261313 is Tier 1 on the Green List."
      />
      <div className="stack-lg">
        <NewZealandScreen
          verificationLogHtml={renderMarkdown(log.markdown)}
          verificationLogFound={log.found}
        />
      </div>
    </PageShell>
  );
}
