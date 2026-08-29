/**
 * /login
 *
 * The link to /signup is only offered when signup is actually open, so the page
 * never invites a visitor through a door that will refuse them.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAnon } from '@/lib/server/auth';
import { signupState } from '@/lib/server/signup';
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords';
import { safeNextPath } from '@/lib/paths';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireAnon();
  const { next } = await searchParams;
  const signup = await signupState().catch(() => ({ open: false, mode: 'unknown', reason: '' }));

  // Only a same origin path is accepted, so ?next= cannot be used to bounce
  // somebody off this server after they sign in. See lib/server/paths.ts.
  const target = safeNextPath(next);

  return (
    <main className="authpage">
      <div className="authcard">
        <div className="authcard__brand">
          <span className="sidebar__mark" aria-hidden="true">
            RT
          </span>
          <span>
            <span className="sidebar__title">The Roadmap Tracker</span>
            <span className="sidebar__sub">28 Aug 2026 to 24 Jan 2027</span>
          </span>
        </div>

        <h1 className="page-head__title">Sign in</h1>
        <p className="muted">One account, one plan, 150 days.</p>

        <AuthForm mode="login" next={target} minPasswordLength={MIN_PASSWORD_LENGTH} />

        {signup.open ? (
          <p className="text-sm muted authcard__alt">
            No account yet? <Link href="/signup">Create one</Link>.
          </p>
        ) : (
          <p className="text-sm muted authcard__alt">
            This tracker already has its account. Account creation closes after the first one,
            because it is built for one person.
          </p>
        )}
      </div>
    </main>
  );
}
