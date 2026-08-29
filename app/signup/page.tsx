/**
 * /signup
 *
 * Guarded twice: `requireAnon` keeps a signed in visitor away, and the signup
 * policy keeps a stranger away once the tracker has its one account.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAnon } from '@/lib/server/auth';
import { signupState } from '@/lib/server/signup';
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords';
import { AuthForm } from '@/components/AuthForm';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  await requireAnon();
  const signup = await signupState().catch(() => ({
    open: false,
    mode: 'unknown-fails-closed',
    reason: 'Account creation is unavailable at the moment. Try signing in.',
  }));

  if (!signup.open) {
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

          <h1 className="page-head__title">Account creation is closed</h1>

          <div className="callout callout--orange">
            <Icon
              path="M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
              className="callout__icon"
            />
            <div className="callout__body">
              <p>{signup.reason}</p>
            </div>
          </div>

          <p className="text-sm muted authcard__alt">
            <Link href="/login">Sign in instead</Link>.
          </p>
        </div>
      </main>
    );
  }

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

        <h1 className="page-head__title">Create your account</h1>
        <p className="muted">Email and password. Nothing else, and nothing third party.</p>

        <AuthForm mode="signup" next="/" minPasswordLength={MIN_PASSWORD_LENGTH} />

        <p className="text-sm muted authcard__alt">
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </main>
  );
}
