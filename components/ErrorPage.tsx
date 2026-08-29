/**
 * ErrorPage | the single centred card the Express build rendered for 404 and 500.
 *
 * Two ways out, both of them useful: Today, and the list of everything.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

export function ErrorPage({
  status,
  heading,
  message,
  children,
}: {
  status: number | string;
  heading: string;
  message: ReactNode;
  /** Extra actions, for example the error boundary's retry button. */
  children?: ReactNode;
}) {
  return (
    <main className="authpage">
      <div className="authcard">
        <div className="authcard__brand">
          <span className="sidebar__mark" aria-hidden="true">
            RT
          </span>
          <span>
            <span className="sidebar__title">The Roadmap Tracker</span>
            <span className="sidebar__sub">Error {status}</span>
          </span>
        </div>
        <h1 className="page-head__title">{heading}</h1>
        <p className="muted">{message}</p>
        <div className="row">
          <Link className="btn btn--primary" href="/">
            Go to Today
          </Link>
          <Link className="btn" href="/everything">
            Everything A to Z
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}

export default ErrorPage;
