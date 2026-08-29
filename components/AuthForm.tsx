'use client';

/**
 * AuthForm | sign in and sign up, in one component.
 *
 * The password strength meter is advisory. The rules that actually decide are
 * enforced on the server, and its message is shown verbatim when it refuses.
 * Neither path ever says whether an email has an account.
 */

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { safeNextPath } from '@/lib/paths';
import { useToast } from './ToastProvider';

const LABELS = [
  'Too short to be safe.',
  'Weak. Make it longer.',
  'Getting there. Longer is better than stranger.',
  'Good.',
  'Strong.',
];

function score(value: string, minPassword: number): number {
  const p = String(value ?? '');
  if (!p) return 0;
  let s = 0;
  if (p.length >= minPassword) s += 1;
  if (p.length >= 16) s += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes >= 2) s += 1;
  if (classes >= 3 && p.length >= 14) s += 1;
  return Math.min(4, s);
}

export interface AuthFormProps {
  mode: 'login' | 'signup';
  next: string;
  minPasswordLength: number;
}

export function AuthForm({ mode, next, minPasswordLength }: AuthFormProps) {
  const { toast, toastError } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = score(password, minPasswordLength);
  const strengthText =
    password.length === 0
      ? `At least ${minPasswordLength} characters. Length beats symbols.`
      : password.length < minPasswordLength
        ? `${minPasswordLength - password.length} more characters needed.`
        : LABELS[strength];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (!email) {
      setFieldErrors({ email: 'Your email is needed to sign in.' });
      return;
    }
    if (!password) {
      setFieldErrors({ password: 'Your password is needed.' });
      return;
    }
    if (mode === 'signup') {
      if (!displayName.trim()) {
        setFieldErrors({ display_name: 'Your name cannot be blank.' });
        return;
      }
      if (password.length < minPasswordLength) {
        setFieldErrors({ password: `Use at least ${minPasswordLength} characters.` });
        return;
      }
    }

    setBusy(true);
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? { email, password, display_name: displayName.trim() }
          : { email, password, next };
      const result = await api.raw<{ next?: string }>('POST', path, payload);
      toast(mode === 'signup' ? 'Account created.' : 'Signed in.', 'ok');
      // A full navigation, so the new session is picked up by every server component.
      // The server has already sanitised this, and it is checked again here because
      // this is the line that actually moves the browser.
      window.location.href = safeNextPath(result.next);
    } catch (err) {
      const e = err as ApiError;
      setBusy(false);
      // The server message is shown as written.
      setFormError(e.message);
      if (e.details) {
        const next: Record<string, string> = {};
        for (const d of e.details) if (d.field) next[d.field] = d.message;
        setFieldErrors(next);
      }
      if (e.code === 'RATE_LIMITED') toastError(e.message);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {mode === 'signup' ? (
        <div className="field">
          <label className="field__label" htmlFor="display_name">
            Your name
          </label>
          <input
            className="input"
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={displayName}
            aria-invalid={fieldErrors.display_name ? true : undefined}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="field__error" role="alert">
            {fieldErrors.display_name ?? ''}
          </p>
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="email">
          Email
        </label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          maxLength={255}
          spellCheck={false}
          value={email}
          aria-invalid={fieldErrors.email ? true : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="field__error" role="alert">
          {fieldErrors.email ?? ''}
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="password">
          Password
        </label>
        <div className="pwwrap">
          <input
            className="input"
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            maxLength={200}
            value={password}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={mode === 'signup' ? 'strength-text pw-hint' : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {mode === 'signup' ? (
          <>
            <div className="strength" data-score={String(strength)}>
              <div className="strength__bars" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="strength__bar" data-on={i < strength ? '1' : '0'} />
                ))}
              </div>
              <p className="strength__text" id="strength-text" aria-live="polite">
                {strengthText}
              </p>
            </div>
            <p className="field__hint" id="pw-hint">
              Checked against a local list of commonly used passwords. Hashed with Argon2id.
            </p>
          </>
        ) : null}

        <p className="field__error" role="alert">
          {fieldErrors.password ?? ''}
        </p>
      </div>

      <p className="field__error" role="alert">
        {formError}
      </p>

      <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={busy}>
        {busy
          ? mode === 'signup'
            ? 'Creating your account'
            : 'Signing in'
          : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
      </button>
    </form>
  );
}

export default AuthForm;
