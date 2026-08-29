import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { PageHead } from '@/components/ui/Basics';
import { ProfileScreen } from './ProfileScreen';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <PageShell title="Profile" path="/profile">
      <PageHead
        title="Profile"
        lede="Your details, your links, your GitHub token and your password."
      />
      <div className="stack-lg">
        <ProfileScreen />
      </div>
    </PageShell>
  );
}
