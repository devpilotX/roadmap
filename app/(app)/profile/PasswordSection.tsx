'use client';

/**
 * The password panel.
 *
 * It says the thing people get wrong: length beats symbols, and the floor is
 * twelve characters. The meter here is advisory. The rule that actually decides
 * lives on the server and its refusal is shown verbatim when it says no.
 */

import { useRef, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { Section } from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { api, ApiError } from '@/lib/client/api';

/** Mirrors MIN_PASSWORD_LENGTH on the server. */
const MIN_PASSWORD = 12;

const SCORE_TEXT = [
  'Too short to be safe.',
  'Weak. Make it longer.',
  'Getting there. Longer is better than stranger.',
  'Good.',
  'Strong.',
];

/**
 * Advisory only, and deliberately weighted towards length. Four bars, matching
 * the four data-score steps in design.css.
 */
function scorePassword(value: string): number {
  const p = String(value ?? '');
  if (!p) return 0;
  let s = 0;
  if (p.length >= MIN_PASSWORD) s += 1;
  if (p.length >= 16) s += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes >= 2) s += 1;
  if (classes >= 3 && p.length >= 14) s += 1;
  return Math.min(4, s);
}

export function PasswordSection() {
  const { toastOk } = useToast();

  const currentRef = useRef<HTMLInputElement | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const score = scorePassword(next);
  const len = next.length;
  const meterText =
    len === 0
      ? `At least ${MIN_PASSWORD} characters. Length beats symbols.`
      : len < MIN_PASSWORD
        ? `${MIN_PASSWORD - len} more characters needed. Length beats symbols.`
        : SCORE_TEXT[score];

  const submit = async () => {
    setError('');
    if (!current) {
      setError('Your current password is needed to change it.');
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters. Length beats symbols.`);
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<{ other_sessions_ended?: number }>('/api/me/password', {
        current_password: current,
        new_password: next,
      });
      setCurrent('');
      setNext('');
      setRevealed(false);
      const ended = Number(result.other_sessions_ended ?? 0);
      toastOk(
        ended
          ? `Password changed. ${ended} other ${
              ended === 1 ? 'session was' : 'sessions were'
            } signed out.`
          : 'Password changed.'
      );
    } catch (err) {
      // The server owns the rules. Its refusal is shown exactly as written.
      setError((err as ApiError).message);
      currentRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Password"
      lede="The meter is advisory. The rules that decide are enforced on the server."
    >
      <Field label="Current password" htmlFor="pf-current-password">
        <input
          ref={currentRef}
          id="pf-current-password"
          className="input"
          type="password"
          autoComplete="current-password"
          aria-label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>

      {/* The reveal button sits beside the input, so the label is associated by id
          rather than by wrapping. A button inside a label would fire on a label click. */}
      <div className="field">
        <label className="field__label" htmlFor="pf-new-password">
          New password
        </label>
        <div className="pwwrap">
          <input
            id="pf-new-password"
            className="input"
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--sm"
            aria-label={revealed ? 'Hide the new password' : 'Show the new password'}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="strength" data-score={String(score)}>
        <div className="strength__bars">
          {[0, 1, 2, 3].map((i) => (
            <div className="strength__bar" data-on={i < score ? '1' : '0'} key={i} />
          ))}
        </div>
        <p className="strength__text">{meterText}</p>
      </div>

      <p className="field__error" role="alert">
        {error}
      </p>

      <div className="row">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={submit}>
          Change my password
        </button>
      </div>

      <p className="text-sm muted measure">
        Length beats symbols. A minimum of 12 characters is enforced, and four ordinary words are
        stronger and easier to remember than one word with punctuation stirred through it. Changing
        your password signs out every other session.
      </p>
    </Section>
  );
}

export default PasswordSection;
