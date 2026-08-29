'use client';

/**
 * The error boundary for every screen.
 *
 * The reason is never shown to the visitor, because it can carry internals. It
 * goes to the console, and the card says plainly that nothing was saved, which
 * is the one thing the person actually needs to know.
 */

import { useEffect } from 'react';
import { ErrorPage } from '@/components/ErrorPage';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      status={500}
      heading="Something broke on the server"
      message="Nothing was saved. The error is in the server log with a timestamp."
    >
      <button type="button" className="btn" onClick={reset}>
        Try that again
      </button>
    </ErrorPage>
  );
}
