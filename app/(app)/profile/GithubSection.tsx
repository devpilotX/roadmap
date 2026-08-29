'use client';

/**
 * The GitHub token, which decides the sync rate limit.
 *
 * With a token GitHub allows 5,000 requests an hour; without one it allows 60 an
 * hour per IP address, shared with everything else on that address. The active
 * mode is stated at the top of the panel, because a throttled sync looks exactly
 * like a day with no pushes.
 *
 * The token is write only. It is sent on save and never read back, because no
 * response in this application returns it, not even masked.
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { Section } from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { api, ApiError } from '@/lib/client/api';
import type { MeProfile } from './types';

export function GithubSection({ profile }: { profile: MeProfile | null }) {
  const { toast, toastOk, toastError } = useToast();

  const [has, setHas] = useState(Boolean(profile?.has_github_token));
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  // The old script repainted this panel after a write, and its repainted anonymous
  // sentence is shorter than the one on first paint. Both are kept.
  const [painted, setPainted] = useState(false);

  const save = async () => {
    const value = token.trim();
    if (value.length < 8) {
      toastError('That is too short to be a token. Paste the whole thing.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.put<{ has_github_token: boolean }>('/api/me/github-token', {
        token: value,
      });
      setToken('');
      setHas(Boolean(result.has_github_token));
      setPainted(true);
      toastOk('Token stored. The sync is authenticated from now on.');
    } catch (err) {
      // Storage needs TOKEN_ENC_KEY. The server says so plainly, so it is shown as written.
      setHas(Boolean(profile?.has_github_token));
      setPainted(true);
      toastError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await api.put<{ has_github_token: boolean }>('/api/me/github-token', {
        token: '',
      });
      setHas(Boolean(result.has_github_token));
      setPainted(true);
      // Removing a token is a downgrade, so it is said as a warning rather than a tick.
      toast('Token removed. The sync is back to 60 requests an hour per IP address.', 'warn');
    } catch (err) {
      setHas(true);
      setPainted(true);
      toastError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const modeLine = has
    ? 'A token is stored, so the push sync runs authenticated: 5,000 requests an hour.'
    : painted
      ? 'No token is stored, so the push sync runs anonymously: 60 requests an hour per IP address, against 5,000 with a token.'
      : 'No token is stored, so the push sync runs anonymously: 60 requests an hour per IP address, against 5,000 with a token. Sixty is shared with everything else on that address, and a throttled sync looks exactly like a day with no pushes.';

  return (
    <Section
      title="GitHub token"
      lede="This is the only setting that changes how much GitHub lets this app ask for."
    >
      <div className="row">
        <span className="card__label">Current mode</span>
        <span className={`badge ${has ? 'badge--green' : 'badge--orange'}`}>
          {has ? 'Authenticated' : 'Anonymous'}
        </span>
      </div>
      <p className="measure">{modeLine}</p>
      {/* Both figures are stated whichever mode is live, so the cost of the choice
          is on the screen and not only in the branch you happen to be in. */}
      <ul className="stack-sm">
        <li>Authenticated, a token stored: 5,000 requests an hour.</li>
        <li>
          Anonymous, no token: 60 requests an hour per IP address, shared with everything else on
          that address.
        </li>
      </ul>

      <Field
        label="Personal access token"
        hint="A classic token with public_repo, or a fine grained token with read access to contents. Nothing more."
        htmlFor="pf-github-token"
      >
        <input
          id="pf-github-token"
          className="input"
          type="password"
          autoComplete="off"
          placeholder="ghp_ or github_pat_"
          aria-label="GitHub personal access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </Field>

      <div className="row">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
          {has ? 'Replace the token' : 'Save the token'}
        </button>
        <button type="button" className="btn btn--danger" disabled={busy || !has} onClick={remove}>
          Remove the token
        </button>
      </div>

      <div className="callout callout--blue">
        <div className="callout__body">
          <p className="callout__title">The token is write only</p>
          <p className="measure">
            It is encrypted before it is stored and no response in this application ever returns it,
            not even masked. If you lose it, generate a new one on GitHub and paste it here. Removing
            it does not delete any push already recorded.
          </p>
        </div>
      </div>
    </Section>
  );
}

export default GithubSection;
