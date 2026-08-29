import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { ProjectsScreen } from './ProjectsScreen';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  return (
    <PageShell title="Projects" wide path="/projects">
      <PageHead title="Projects" lede="One problem taken three times, then a second problem." />
      <div className="stack-lg">
        <ProjectsScreen />
      </div>
    </PageShell>
  );
}
