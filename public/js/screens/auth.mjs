/**
 * auth.mjs | login and signup.
 *
 * The password strength meter is advisory. The rules that actually decide are
 * enforced on the server, and its message is shown verbatim when it refuses.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { qs } from '../ui.mjs';

const body = document.body;
const mode = body.dataset.mode;
const form = qs('#auth-form');
const submit = qs('#submit');
const formError = qs('#form-error');
const password = qs('#password');
const minPassword = Number(body.dataset.minPassword || 12);

/* --------------------------------------------------------- show and hide */

const toggle = qs('#pw-toggle');
toggle?.addEventListener('click', () => {
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  toggle.textContent = showing ? 'Show' : 'Hide';
  toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

/* -------------------------------------------------------- strength meter */

const strength = qs('#strength');
const strengthText = qs('#strength-text');

const LABELS = [
  'Too short to be safe.',
  'Weak. Make it longer.',
  'Getting there. Longer is better than stranger.',
  'Good.',
  'Strong.',
];

function score(value) {
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

if (strength && password) {
  password.addEventListener('input', () => {
    const s = score(password.value);
    strength.dataset.score = String(s);
    strength.querySelectorAll('.strength__bar').forEach((bar, i) => {
      bar.dataset.on = i < s ? '1' : '0';
    });
    if (strengthText) {
      strengthText.textContent =
        password.value.length === 0
          ? `At least ${minPassword} characters. Length beats symbols.`
          : password.value.length < minPassword
            ? `${minPassword - password.value.length} more characters needed.`
            : LABELS[s];
    }
  });
}

/* ------------------------------------------------------------- submitting */

function clearErrors() {
  formError.textContent = '';
  for (const el of document.querySelectorAll('.field__error')) el.textContent = '';
  for (const el of document.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
}

function showFieldError(field, message) {
  const node = qs(`#${field}-error`);
  if (node) node.textContent = message;
  const input = qs(`#${field}`);
  if (input) input.setAttribute('aria-invalid', 'true');
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const data = Object.fromEntries(new FormData(form).entries());
  delete data._csrf;

  if (!data.email) {
    showFieldError('email', 'Your email is needed to sign in.');
    return;
  }
  if (!data.password) {
    showFieldError('password', 'Your password is needed.');
    return;
  }
  if (mode === 'signup') {
    if (!String(data.display_name ?? '').trim()) {
      showFieldError('display_name', 'Your name cannot be blank.');
      return;
    }
    if (String(data.password).length < minPassword) {
      showFieldError('password', `Use at least ${minPassword} characters.`);
      return;
    }
  }

  submit.disabled = true;
  const originalLabel = submit.textContent;
  submit.textContent = mode === 'signup' ? 'Creating your account' : 'Signing in';

  try {
    const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const result = await api.raw('POST', path, data);
    toast(mode === 'signup' ? 'Account created.' : 'Signed in.', 'ok');
    window.location.href = result.next || '/';
  } catch (err) {
    submit.disabled = false;
    submit.textContent = originalLabel;
    // The server message is shown as written. It never says whether the email exists.
    formError.textContent = err.message;
    if (err.details) {
      for (const d of err.details) {
        if (d.field) showFieldError(d.field, d.message);
      }
    }
    if (err.code === 'RATE_LIMITED') toastError(err.message);
    password.focus();
    password.select?.();
  }
});
