/**
 * profile.mjs | the person behind the roadmap, and the four things only they can
 * change: their details, their links, their GitHub token and their password.
 *
 * This screen serves Part 18, the tracking contract, and Part 19, the honesty
 * rules. Two of its panels carry a cost that is easy to get wrong and so it is
 * written on the screen rather than left to be discovered.
 *
 * The GitHub token decides the sync rate limit. With a token GitHub allows 5,000
 * requests an hour; without one it allows 60 an hour per IP address, shared with
 * everything else on that address. The active mode is stated at the top of that
 * panel, because a throttled sync looks exactly like a day with no pushes.
 *
 * The password panel says the thing people get wrong: length beats symbols, and
 * the floor is twelve characters. The meter here is advisory. The rule that
 * actually decides lives in src/lib/passwords.mjs and its refusal is shown
 * verbatim when the server says no.
 *
 * The token is write only. It is sent on save and never read back, because no
 * response in this application returns it, not even masked.
 *
 * The data panel ends with the operational record from GET /api/ops. A link to an
 * export route only proves the route exists, so the rows the backup, link check
 * and import scripts write are read back here. When a script has never run that is
 * stated, with the command, rather than left to look like it is handled.
 */

import { api } from '../api.mjs';
import { toast, toastError, toastOk } from '../toast.mjs';
import { el, emptyState, int, optimistic, shortDate, svgIcon } from '../ui.mjs';
import { errorCard, loadingCard, mount, section, table } from '../render.mjs';

/** Mirrors MIN_PASSWORD_LENGTH in src/lib/passwords.mjs. */
const MIN_PASSWORD = 12;

const THEMES = [
  { value: 'system', label: 'Follow the system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const CALENDAR_VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

/** The six blocks of the day, from Part 2. The API accepts exactly these codes. */
const BLOCKS = [
  { code: 'DSA', label: 'DSA, first thing' },
  { code: 'LEARN', label: 'Learn, 09:30 to 12:30' },
  { code: 'BUILD', label: 'Build, 14:00 to 16:00' },
  { code: 'CLOSE', label: 'Close the day' },
  { code: 'MONEY', label: 'Money hour' },
  { code: 'NIGHT', label: 'Night segments' },
];

/**
 * The tables the export routes accept, mirroring src/lib/exportTables.mjs. The
 * user tables come first because those are the ones that hold your own record.
 */
const USER_TABLES = [
  'day_logs', 'dsa_progress', 'dsa_topic_progress', 'week_day_progress', 'resource_progress',
  'week_link_progress', 'study_sessions', 'gate_results', 'money_gate_results', 'sunday_logs',
  'project_progress', 'github_repos', 'github_pushes', 'applications', 'mock_interviews',
  'writeups', 'leads', 'lead_touches', 'deals', 'care_plans', 'nz_progress',
  'continuation_progress', 'money_script_versions', 'audit_log',
];

const REFERENCE_TABLES = [
  'weeks', 'week_days', 'calendar_days', 'week_links', 'resources', 'resource_categories',
  'gates', 'money_gates', 'sundays', 'projects', 'offers', 'money_week_targets',
  'money_scripts', 'roles', 'roles_early', 'skills', 'eligibility_weeks', 'eligibility_dsa',
  'fast_exits', 'skill_combos', 'warning_rules', 'corrections', 'stack_versions',
];

const ICON = {
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.8a5.3 5.3 0 0 0-1.5-3.6 4.9 4.9 0 0 0-.1-3.7s-1.2-.4-4 1.5a13 13 0 0 0-6.9 0C6 1 4.8 1.4 4.8 1.4a4.9 4.9 0 0 0-.1 3.7A5.3 5.3 0 0 0 3.2 8.7c0 5.3 3.1 6.5 6.1 6.8a3.4 3.4 0 0 0-.9 2.6V22',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  download: 'M12 3v12M8 11l4 4 4-4M4 19h16',
};

/* ------------------------------------------------------------------ helpers */

function field(labelText, control, hint) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field__label', text: labelText }),
    control,
    hint ? el('span', { class: 'field__hint', text: hint }) : null,
  ]);
}

function textInput(value, attrs = {}) {
  return el('input', { class: 'input', type: 'text', autocomplete: 'off', ...attrs, value: value ?? '' });
}

function selectOf(options, current, label) {
  return el(
    'select',
    { class: 'select', 'aria-label': label },
    options.map((o) => el('option', { value: o.value, text: o.label, selected: o.value === current }))
  );
}

/** The switch component from components.css. A checkbox, styled as a switch. */
function switchRow(labelText, checked, hint, onChange) {
  const box = el('input', { class: 'switch__input', type: 'checkbox', checked });
  box.addEventListener('change', () => onChange(box.checked, box));
  return el('label', { class: 'switch' }, [
    box,
    el('span', { class: 'stack-sm' }, [
      el('span', { class: 'text-sm', text: labelText }),
      hint ? el('span', { class: 'field__hint', text: hint }) : null,
    ]),
  ]);
}

function initialsOf(name, email) {
  const source = String(name ?? '').trim() || String(email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

/**
 * Advisory only, and deliberately weighted towards length. Four bars, matching
 * the four data-score steps in components.css.
 */
function scorePassword(value) {
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

const SCORE_TEXT = [
  'Too short to be safe.',
  'Weak. Make it longer.',
  'Getting there. Longer is better than stranger.',
  'Good.',
  'Strong.',
];

function strengthMeter() {
  const bars = el('div', { class: 'strength__bars' });
  const barNodes = [];
  for (let i = 0; i < 4; i += 1) {
    const bar = el('div', { class: 'strength__bar', 'data-on': '0' });
    barNodes.push(bar);
    bars.appendChild(bar);
  }
  const idle = `At least ${MIN_PASSWORD} characters. Length beats symbols.`;
  const text = el('p', { class: 'strength__text', text: idle });
  const wrap = el('div', { class: 'strength', 'data-score': '0' }, [bars, text]);

  return {
    wrap,
    update(value) {
      const s = scorePassword(value);
      wrap.setAttribute('data-score', String(s));
      barNodes.forEach((bar, i) => bar.setAttribute('data-on', i < s ? '1' : '0'));
      const len = String(value ?? '').length;
      text.textContent =
        len === 0
          ? idle
          : len < MIN_PASSWORD
            ? `${MIN_PASSWORD - len} more characters needed. Length beats symbols.`
            : SCORE_TEXT[s];
    },
  };
}

/* --------------------------------------------------------------- pf-form */

function identityCard(user, profile) {
  const avatar = profile?.avatar_path
    ? el('div', { class: 'avatar' }, [
        el('img', { src: profile.avatar_path, alt: `${user.display_name ?? 'Your'} avatar`, width: 64, height: 64 }),
      ])
    : el('div', { class: 'avatar', text: initialsOf(profile?.full_name ?? user.display_name, user.email) });

  return el('div', { class: 'card stack-sm' }, [
    el('div', { class: 'avatarrow' }, [
      avatar,
      el('div', {}, [
        el('p', { class: 'card__title', text: user.display_name ?? user.email }),
        el('p', { class: 'text-sm muted', text: user.email }),
        el('p', {
          class: 'text-xs muted',
          text: [
            user.created_at ? `Account opened ${shortDate(String(user.created_at).slice(0, 10))}` : null,
            user.last_login_at ? `last signed in ${shortDate(String(user.last_login_at).slice(0, 10))}` : null,
          ].filter(Boolean).join(', '),
        }),
      ]),
    ]),
    el('p', {
      class: 'field__hint',
      text: 'There is no avatar upload here. The circle shows your initials unless avatar_path has been set on the profile row directly.',
    }),
  ]);
}

function profileForm(user, profile, serverTimezone) {
  const displayName = textInput(user.display_name, { maxlength: 120, autocomplete: 'nickname' });
  const fullName = textInput(profile?.full_name, { maxlength: 160, autocomplete: 'name' });
  const phone = el('input', { class: 'input', type: 'tel', autocomplete: 'tel', maxlength: 32, value: profile?.phone ?? '' });
  const city = textInput(profile?.city, { maxlength: 120 });
  const targetRole = textInput(profile?.target_role, { maxlength: 8 });
  const timezone = textInput(profile?.timezone, { maxlength: 64 });
  const bio = el('textarea', { class: 'textarea', rows: 4, maxlength: 2000 });
  bio.value = profile?.bio ?? '';

  /**
   * The day the roadmap starts for this person.
   *
   * The 150 day window itself cannot move: final.md fixes every date in it and
   * the four gate dates, and `npm run verify` enforces them. What this sets is the
   * day scoring begins. Days inside the window but before it are neutral rather
   * than red, so starting on a Saturday does not open with a failure.
   */
  const startOn = el('input', {
    class: 'input',
    type: 'date',
    value: (profile?.roadmap_start ?? '').slice(0, 10),
    min: (profile?.roadmap_start ?? '2026-08-28') < '2026-08-28' ? undefined : '2026-08-28',
    max: '2027-01-24',
  });
  const startSave = el('button', { type: 'button', class: 'btn btn--sm', text: 'Set the start date' });
  const startNote = el('p', { class: 'field__hint', text: '' });

  const describeStart = () => {
    const v = startOn.value;
    if (!v) {
      startNote.textContent = 'Pick a date inside the window.';
      return;
    }
    const today = document.body.dataset.today ?? '';
    startNote.textContent =
      v === '2026-08-28'
        ? 'The first day of the window, which is what the plan assumes.'
        : v > today
          ? `Days from 28 August up to ${v} will be neutral: not green, not red, and no warnings.`
          : `Scoring starts on ${v}. Days before it stay neutral.`;
  };
  startOn.addEventListener('change', describeStart);
  describeStart();

  startSave.addEventListener('click', async () => {
    startSave.disabled = true;
    try {
      await api.patch('/api/me/profile', { roadmap_start: startOn.value });
      toastOk('Start date saved. Every day already on file has been repainted.');
      describeStart();
    } catch (err) {
      toastError(err.message);
    } finally {
      startSave.disabled = false;
    }
  });

  const save = el('button', { type: 'button', class: 'btn btn--primary', text: 'Save these details' });

  save.addEventListener('click', async () => {
    const patch = {
      full_name: fullName.value.trim(),
      phone: phone.value.trim(),
      city: city.value.trim(),
      target_role: targetRole.value.trim(),
      timezone: timezone.value.trim(),
      bio: bio.value,
    };
    // display_name lives on the users row and the API refuses a blank one, so it
    // is only sent when there is something to send.
    if (displayName.value.trim()) patch.display_name = displayName.value.trim();

    save.disabled = true;
    try {
      await api.patch('/api/me/profile', patch);
      toastOk('Your details are saved.');
    } catch (err) {
      toastError(err.message);
    } finally {
      save.disabled = false;
    }
  });

  return section(
    'Your details',
    [
      el('div', { class: 'grid grid--2' }, [
        field('Display name', displayName, 'What the sidebar and the greeting use.'),
        field('Full name', fullName, 'The name on a CV, if it differs.'),
        field('Phone', phone),
        field('City', city),
        field('Target role code', targetRole, 'A role code from the seven roles, eight characters at most.'),
        field('Timezone', timezone, `Every date in this app is worked out in ${serverTimezone ?? 'the server timezone'}. Changing this does not move the clock.`),
      ]),
      field('Bio', bio, 'Two or three sentences. This is not a personal statement.'),
      el('div', { class: 'row' }, [save]),
      el('div', { class: 'card__foot stack-sm' }, [
        el('p', { class: 'card__label', text: 'The day the roadmap starts for you' }),
        el('p', {
          class: 'text-sm muted measure',
          text:
            'The 150 day window runs 28 August 2026 to 24 January 2027 and cannot move: final.md fixes every date in it, ' +
            'including the four gate dates, and the seed verifier enforces them. What you can move is the day scoring begins. ' +
            'Days inside the window but before it are neutral, so they never break a streak, never count as red, and raise no warning.',
        }),
        el('div', { class: 'row' }, [startOn, startSave]),
        startNote,
      ]),
    ],
    { lede: 'Everything here is optional except a display name, which cannot be blank once it exists.' }
  );
}

function settingsCard(settings) {
  const theme = selectOf(THEMES, settings.theme, 'Theme');
  theme.addEventListener('change', async () => {
    const before = document.documentElement.dataset.theme || 'system';
    const want = theme.value;
    try {
      await optimistic({
        apply: () => {
          document.documentElement.dataset.theme = want;
        },
        revert: () => {
          document.documentElement.dataset.theme = before;
          theme.value = before;
        },
        write: () => api.patch('/api/me/settings', { theme: want }),
      });
      toastOk('Theme saved.');
    } catch (err) {
      toastError(err.message);
    }
  });

  const calendar = selectOf(CALENDAR_VIEWS, settings.calendar_view, 'Default calendar view');
  calendar.addEventListener('change', async () => {
    const before = settings.calendar_view;
    const want = calendar.value;
    try {
      await optimistic({
        apply: () => {
          settings.calendar_view = want;
        },
        revert: () => {
          settings.calendar_view = before;
          calendar.value = before;
        },
        write: () => api.patch('/api/me/settings', { calendar_view: want }),
      });
      toastOk('Calendar view saved.');
    } catch (err) {
      toastError(err.message);
    }
  });

  const active = new Set(settings.notify_blocks ?? []);
  const blockRows = BLOCKS.map((b) =>
    switchRow(b.label, active.has(b.code), null, async (want, box) => {
      const next = new Set(active);
      if (want) next.add(b.code);
      else next.delete(b.code);
      box.disabled = true;
      try {
        await api.patch('/api/me/settings', { notify_blocks: [...next] });
        if (want) active.add(b.code);
        else active.delete(b.code);
      } catch (err) {
        box.checked = !want;
        toastError(err.message);
      } finally {
        box.disabled = false;
      }
    })
  );

  const gates = switchRow(
    'Remind me about gates',
    Boolean(settings.notify_gates),
    'The four gates are fixed dates. This does not move them.',
    async (want, box) => {
      box.disabled = true;
      try {
        await api.patch('/api/me/settings', { notify_gates: want });
        settings.notify_gates = want;
      } catch (err) {
        box.checked = !want;
        toastError(err.message);
      } finally {
        box.disabled = false;
      }
    }
  );

  return section(
    'How the app behaves',
    [
      el('div', { class: 'grid grid--2' }, [
        field('Theme', theme),
        field('Calendar opens on', calendar),
      ]),
      el('p', { class: 'card__label', text: 'Nudge me at the start of these blocks' }),
      el('div', { class: 'stack-sm' }, blockRows),
      gates,
    ],
    { lede: 'These save the moment you change them. There is no separate save button.' }
  );
}

/* -------------------------------------------------------------- pf-links */

function linkPreview(profile) {
  const rows = [
    ['GitHub', profile?.github_user ? `https://github.com/${profile.github_user}` : null, profile?.github_user],
    ['LinkedIn', profile?.linkedin_url, profile?.linkedin_url],
    ['Portfolio', profile?.portfolio_url, profile?.portfolio_url],
    ['Site one', profile?.site_1, profile?.site_1],
    ['Site two', profile?.site_2, profile?.site_2],
    ['Site three', profile?.site_3, profile?.site_3],
  ].filter(([, href]) => Boolean(href));

  if (!rows.length) {
    return el('p', {
      class: 'muted text-sm',
      text: 'No links set yet. A recruiter reads these before they read your CV, so at least the GitHub username and one live URL are worth filling in.',
    });
  }

  return el(
    'div',
    { class: 'linklist' },
    rows.map(([label, href, shown]) =>
      el('div', { class: 'linklist__row' }, [
        svgIcon(label === 'GitHub' ? ICON.github : ICON.link, 'linklist__icon'),
        el('span', {}, [
          el('span', { class: 'muted', text: `${label}: ` }),
          el('a', { href, text: String(shown), target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' }),
        ]),
      ])
    )
  );
}

function linksForm(profile) {
  const githubUser = textInput(profile?.github_user, { maxlength: 120, placeholder: 'your-github-username' });
  const linkedin = el('input', { class: 'input', type: 'url', value: profile?.linkedin_url ?? '', placeholder: 'https://www.linkedin.com/in/you' });
  const portfolio = el('input', { class: 'input', type: 'url', value: profile?.portfolio_url ?? '', placeholder: 'https://your-site' });
  const site1 = el('input', { class: 'input', type: 'url', value: profile?.site_1 ?? '', placeholder: 'https://project-one' });
  const site2 = el('input', { class: 'input', type: 'url', value: profile?.site_2 ?? '', placeholder: 'https://project-two' });
  const site3 = el('input', { class: 'input', type: 'url', value: profile?.site_3 ?? '', placeholder: 'https://project-three' });
  const upi = textInput(profile?.upi_id, { maxlength: 120, placeholder: 'you@bank' });

  const previewHost = el('div', {}, [linkPreview(profile)]);
  const save = el('button', { type: 'button', class: 'btn btn--primary', text: 'Save these links' });

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      // The API rejects anything that is not a full http or https URL, so the
      // fresh profile it returns is what gets drawn back, not what was typed.
      const fresh = await api.patch('/api/me/profile', {
        github_user: githubUser.value.trim(),
        linkedin_url: linkedin.value.trim(),
        portfolio_url: portfolio.value.trim(),
        site_1: site1.value.trim(),
        site_2: site2.value.trim(),
        site_3: site3.value.trim(),
        upi_id: upi.value.trim(),
      });
      previewHost.replaceChildren(linkPreview(fresh));
      toastOk('Your links are saved.');
    } catch (err) {
      toastError(err.message);
    } finally {
      save.disabled = false;
    }
  });

  return section(
    'Your links',
    [
      previewHost,
      el('div', { class: 'grid grid--2' }, [
        field('GitHub username', githubUser, 'Just the username. The push sync uses this.'),
        field('LinkedIn', linkedin),
        field('Portfolio', portfolio),
        field('UPI ID', upi, 'Used on the money screens when you invoice.'),
        field('Site one', site1),
        field('Site two', site2),
        field('Site three', site3),
      ]),
      el('div', { class: 'row' }, [save]),
    ],
    { lede: 'Every URL must start with http:// or https://. A blank field clears the value.' }
  );
}

/* ------------------------------------------------------------- pf-github */

function githubCard(profile) {
  const hasToken = Boolean(profile?.has_github_token);

  const modeBadge = el('span', {
    class: `badge ${hasToken ? 'badge--green' : 'badge--orange'}`,
    text: hasToken ? 'Authenticated' : 'Anonymous',
  });

  const modeLine = el('p', {
    class: 'measure',
    text: hasToken
      ? 'A token is stored, so the push sync runs authenticated: 5,000 requests an hour.'
      : 'No token is stored, so the push sync runs anonymously: 60 requests an hour per IP address, against 5,000 with a token. Sixty is shared with everything else on that address, and a throttled sync looks exactly like a day with no pushes.',
  });

  const token = el('input', {
    class: 'input',
    type: 'password',
    autocomplete: 'off',
    placeholder: 'ghp_ or github_pat_',
    'aria-label': 'GitHub personal access token',
  });

  const save = el('button', { type: 'button', class: 'btn btn--primary', text: hasToken ? 'Replace the token' : 'Save the token' });
  const remove = el('button', { type: 'button', class: 'btn btn--danger', text: 'Remove the token' });

  function paint(has) {
    modeBadge.className = `badge ${has ? 'badge--green' : 'badge--orange'}`;
    modeBadge.textContent = has ? 'Authenticated' : 'Anonymous';
    modeLine.textContent = has
      ? 'A token is stored, so the push sync runs authenticated: 5,000 requests an hour.'
      : 'No token is stored, so the push sync runs anonymously: 60 requests an hour per IP address, against 5,000 with a token.';
    save.textContent = has ? 'Replace the token' : 'Save the token';
    remove.disabled = !has;
  }
  remove.disabled = !hasToken;

  save.addEventListener('click', async () => {
    const value = token.value.trim();
    if (value.length < 8) {
      toastError('That is too short to be a token. Paste the whole thing.');
      return;
    }
    save.disabled = true;
    remove.disabled = true;
    try {
      const result = await api.put('/api/me/github-token', { token: value });
      token.value = '';
      paint(Boolean(result.has_github_token));
      toastOk('Token stored. The sync is authenticated from now on.');
    } catch (err) {
      // Storage needs TOKEN_ENC_KEY. The server says so plainly, so it is shown as written.
      paint(Boolean(profile?.has_github_token));
      toastError(err.message);
    } finally {
      save.disabled = false;
    }
  });

  remove.addEventListener('click', async () => {
    save.disabled = true;
    remove.disabled = true;
    try {
      const result = await api.put('/api/me/github-token', { token: '' });
      paint(Boolean(result.has_github_token));
      toastWarnRemoved();
    } catch (err) {
      paint(true);
      toastError(err.message);
    } finally {
      save.disabled = false;
    }
  });

  return section(
    'GitHub token',
    [
      el('div', { class: 'row' }, [el('span', { class: 'card__label', text: 'Current mode' }), modeBadge]),
      modeLine,
      // Both figures are stated whichever mode is live, so the cost of the choice
      // is on the screen and not only in the branch you happen to be in.
      el('ul', { class: 'stack-sm' }, [
        el('li', { text: 'Authenticated, a token stored: 5,000 requests an hour.' }),
        el('li', { text: 'Anonymous, no token: 60 requests an hour per IP address, shared with everything else on that address.' }),
      ]),
      field('Personal access token', token, 'A classic token with public_repo, or a fine grained token with read access to contents. Nothing more.'),
      el('div', { class: 'row' }, [save, remove]),
      el('div', { class: 'callout callout--blue' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'The token is write only' }),
          el('p', {
            class: 'measure',
            text: 'It is encrypted before it is stored and no response in this application ever returns it, not even masked. If you lose it, generate a new one on GitHub and paste it here. Removing it does not delete any push already recorded.',
          }),
        ]),
      ]),
    ],
    { lede: 'This is the only setting that changes how much GitHub lets this app ask for.' }
  );
}

/** Removing a token is a downgrade, so it is said as a warning rather than a tick. */
function toastWarnRemoved() {
  toast('Token removed. The sync is back to 60 requests an hour per IP address.', 'warn');
}

/* ----------------------------------------------------------- pf-password */

function passwordCard() {
  const current = el('input', {
    class: 'input',
    type: 'password',
    autocomplete: 'current-password',
    'aria-label': 'Current password',
  });
  const next = el('input', {
    id: 'pf-new-password',
    class: 'input',
    type: 'password',
    autocomplete: 'new-password',
  });
  const meter = strengthMeter();
  next.addEventListener('input', () => meter.update(next.value));

  const reveal = el('button', { type: 'button', class: 'btn btn--sm', text: 'Show' });
  reveal.addEventListener('click', () => {
    const showing = next.type === 'text';
    next.type = showing ? 'password' : 'text';
    reveal.textContent = showing ? 'Show' : 'Hide';
    reveal.setAttribute('aria-label', showing ? 'Show the new password' : 'Hide the new password');
  });

  const error = el('p', { class: 'field__error', role: 'alert' });
  const submit = el('button', { type: 'button', class: 'btn btn--primary', text: 'Change my password' });

  submit.addEventListener('click', async () => {
    error.textContent = '';
    if (!current.value) {
      error.textContent = 'Your current password is needed to change it.';
      return;
    }
    if (next.value.length < MIN_PASSWORD) {
      error.textContent = `Use at least ${MIN_PASSWORD} characters. Length beats symbols.`;
      return;
    }
    submit.disabled = true;
    try {
      const result = await api.post('/api/me/password', {
        current_password: current.value,
        new_password: next.value,
      });
      current.value = '';
      next.value = '';
      next.type = 'password';
      reveal.textContent = 'Show';
      meter.update('');
      const ended = Number(result.other_sessions_ended ?? 0);
      toastOk(
        ended
          ? `Password changed. ${ended} other ${ended === 1 ? 'session was' : 'sessions were'} signed out.`
          : 'Password changed.'
      );
    } catch (err) {
      // The server owns the rules. Its refusal is shown exactly as written.
      error.textContent = err.message;
      current.focus();
    } finally {
      submit.disabled = false;
    }
  });

  return section(
    'Password',
    [
      field('Current password', current),
      // The reveal button sits beside the input, so the label is associated by id
      // rather than by wrapping. A button inside a label would fire on a label click.
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'pf-new-password', text: 'New password' }),
        el('div', { class: 'pwwrap' }, [next, reveal]),
      ]),
      meter.wrap,
      error,
      el('div', { class: 'row' }, [submit]),
      el('p', {
        class: 'text-sm muted measure',
        text: 'Length beats symbols. A minimum of 12 characters is enforced, and four ordinary words are stronger and easier to remember than one word with punctuation stirred through it. Changing your password signs out every other session.',
      }),
    ],
    { lede: 'The meter is advisory. The rules that decide are enforced on the server.' }
  );
}

/* --------------------------------------------------------------- pf-data */

function tableLinks(names) {
  return el(
    'div',
    { class: 'row' },
    names.map((name) =>
      el('a', {
        class: 'btn btn--sm btn--ghost',
        href: `/api/export/${name}.csv`,
        text: name,
        download: `${name}.csv`,
      })
    )
  );
}

function dataCard(settings) {
  const slugLine = el('p', {
    class: 'text-sm muted',
    text: settings.public_slug
      ? `Your public slug is ${settings.public_slug}.`
      : 'No public slug has been generated yet. One is created the first time you turn this on.',
  });

  const publicSwitch = switchRow(
    'Make my progress public',
    Boolean(settings.public_progress),
    'This stores a flag and a random slug against your account. Nothing in this build serves a public page yet, so turning it on does not expose anything today.',
    async (want, box) => {
      box.disabled = true;
      try {
        const fresh = await api.patch('/api/me/settings', { public_progress: want });
        settings.public_progress = want;
        settings.public_slug = fresh.public_slug;
        slugLine.textContent = fresh.public_slug
          ? `Your public slug is ${fresh.public_slug}.`
          : 'No public slug has been generated yet.';
        toastOk(want ? 'Public progress turned on.' : 'Public progress turned off.');
      } catch (err) {
        box.checked = !want;
        toastError(err.message);
      } finally {
        box.disabled = false;
      }
    }
  );

  return section(
    'Your data',
    [
      el('p', {
        class: 'measure',
        text: 'Everything this application knows about you can leave it in one click. The JSON export is the whole thing, your progress and the seeded plan it was measured against, because the progress means nothing without the plan.',
      }),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn--primary', href: '/api/export/all.json', download: 'roadmap-export.json' }, [
          svgIcon(ICON.download),
          'Download everything as JSON',
        ]),
      ]),
      el('p', { class: 'card__label', text: 'Or one table at a time, as CSV' }),
      el('p', { class: 'field__hint', text: 'Your own records. Each of these is scoped to you.' }),
      tableLinks(USER_TABLES),
      el('p', { class: 'field__hint', text: 'The seeded plan from final.md. The same for everybody, included so an export stands alone.' }),
      tableLinks(REFERENCE_TABLES),
      el('div', { class: 'stack-sm' }, [publicSwitch, slugLine]),
    ],
    { lede: 'Export routes are GET /api/export/all.json and GET /api/export/:table.csv.' }
  );
}

/* ------------------------------------------------------- pf-data, the record */

/**
 * The operational record, from GET /api/ops.
 *
 * Until this existed the panel above could link to the export routes but could not
 * say whether a backup had ever actually been taken. A link to an export is not a
 * backup and a script that has never run is not a safety net, so this block reads
 * the rows the scripts themselves wrote and says plainly when nothing has run.
 *
 * Nothing here runs anything. There is no endpoint that executes a script, which
 * is why the commands are printed rather than offered as buttons.
 */

/** The command labels GET /api/ops returns, so a command is quoted rather than written here. */
const OPS_LABEL = {
  links: 'Check every link',
  dump: 'Back up the database',
  export: 'Export everything to disk',
  dsa: 'Import a DSA export',
};

function commandFor(commands, label) {
  const hit = (commands ?? []).find((c) => c.label === label);
  return hit ? hit.command : null;
}

/** A run command as a sentence, or an honest gap if the API did not report one. */
function runLine(commands, label) {
  const cmd = commandFor(commands, label);
  return cmd ? `Run ${cmd}.` : `The command for "${label}" was not in the list below.`;
}

/**
 * DATE and DATETIME arrive as strings because dateStrings is on in the pool, so
 * the first ten characters are the date. A Date object is still handled, because
 * one bad assumption here would throw inside a date formatter.
 */
function stampDay(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function whenLabel(value) {
  const day = stampDay(value);
  return day ? shortDate(day) : 'at a time that was not recorded';
}

/** bytes is a BIGINT and nullable, so a missing size is said rather than shown as zero. */
function bytesLabel(bytes) {
  if (bytes === null || bytes === undefined) return 'size not recorded';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return 'size not recorded';
  if (n < 1024) return `${int(n)} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** One backup line. `ok` is a flag on the row, so a failed run is not read as a backup. */
function backupLine(what, row, neverText) {
  if (!row) return el('p', { class: 'measure', text: neverText });
  const failed = Number(row.ok) !== 1;
  return el('div', { class: 'stack-sm' }, [
    el('p', {
      class: 'measure',
      text: `The last ${what} ran on ${whenLabel(row.ran_at)}: ${row.file_name}, ${bytesLabel(row.bytes)}.`,
    }),
    failed
      ? el('p', {
          class: 'text-sm',
          text: `That run is recorded as failed, so it is not a backup. ${row.message ?? 'No reason was recorded.'}`,
        })
      : null,
  ]);
}

function backupsBlock(backups, commands) {
  return el('div', { class: 'stack-sm' }, [
    el('p', { class: 'card__label', text: 'Backups' }),
    backupLine(
      'database dump',
      backups?.last_dump,
      `No database dump has ever run. ${runLine(commands, OPS_LABEL.dump)}`
    ),
    backupLine(
      'export',
      backups?.last_export,
      `No export has ever run. ${runLine(commands, OPS_LABEL.export)}`
    ),
    backups?.note ? el('p', { class: 'text-sm muted measure', text: backups.note }) : null,
  ]);
}

/**
 * Dead links, from both lists the API returns. A dead link is flagged and kept,
 * never deleted, so this table is the list of things to replace rather than a
 * list of things that have gone.
 */
function deadLinkRows(linkCheck) {
  return [
    ...(linkCheck?.dead_resources ?? []).map((r) => ({
      where: `Library, category ${r.category_no}, item ${r.ord}`,
      label: r.label,
      url: r.url,
      last_status: r.last_status,
      last_checked: r.last_checked,
    })),
    ...(linkCheck?.dead_week_links ?? []).map((r) => ({
      where: `Week ${r.week_n}, link ${r.ord}`,
      label: r.label,
      url: r.url,
      last_status: r.last_status,
      last_checked: r.last_checked,
    })),
  ];
}

function linkCheckBlock(linkCheck, commands) {
  const last = linkCheck?.last ?? null;
  const dead = deadLinkRows(linkCheck);
  const total = Number(linkCheck?.dead_total ?? 0);

  const heading = el('p', { class: 'card__label', text: 'Link check' });

  if (!last) {
    return el('div', { class: 'stack-sm' }, [
      heading,
      emptyState(
        'The link check has never run',
        `No run is on record, so no url in the library or in the week links has been verified by this application. ${runLine(commands, OPS_LABEL.links)}`
      ),
      linkCheck?.note ? el('p', { class: 'text-sm muted measure', text: linkCheck.note }) : null,
    ]);
  }

  // finished_at is nullable: a run that was interrupted has a start and no end.
  const when = last.finished_at
    ? `finished on ${whenLabel(last.finished_at)}`
    : `started on ${whenLabel(last.started_at)} and has no finish time on record`;
  const runs = Number(linkCheck?.runs?.length ?? 0);

  return el('div', { class: 'stack-sm' }, [
    heading,
    el('p', {
      class: 'measure',
      text: `The last check ${when}. It checked ${int(last.checked_count)} urls and found ${int(last.dead_count)} dead. ${runs} run${runs === 1 ? '' : 's'} on record.`,
    }),
    last.notes ? el('p', { class: 'text-sm muted measure', text: last.notes }) : null,
    total === 0
      ? emptyState(
          'Nothing is flagged as dead',
          'No library resource and no week link carries a dead flag, so there is nothing on the replacement list.'
        )
      : table({
          caption: `${total} dead link${total === 1 ? '' : 's'}, flagged and kept rather than deleted.`,
          columns: [
            { key: 'where', label: 'Where' },
            { key: 'label', label: 'Link' },
            { key: 'url', label: 'Url', render: (r) => el('span', { class: 'mono', text: r.url }) },
            {
              key: 'last_status',
              label: 'Status',
              num: true,
              render: (r) => (r.last_status === null || r.last_status === undefined ? 'no answer' : String(r.last_status)),
            },
            {
              key: 'last_checked',
              label: 'Last checked',
              render: (r) => (stampDay(r.last_checked) ? shortDate(stampDay(r.last_checked)) : 'not recorded'),
            },
          ],
          rows: dead,
        }),
    linkCheck?.note ? el('p', { class: 'text-sm muted measure', text: linkCheck.note }) : null,
  ]);
}

/**
 * The DSA import. dry_run defaults to 1 in the table, so a row is not evidence
 * that anything was written: the split is reported either way and the flag is
 * what decides whether /dsa has problem level data behind it.
 */
function dsaImportBlock(dsaImports, commands) {
  const last = dsaImports?.last ?? null;
  const rows = dsaImports?.rows ?? [];
  const real = rows.find((r) => Number(r.dry_run) !== 1) ?? null;
  const heading = el('p', { class: 'card__label', text: 'DSA import' });

  if (!last) {
    return el('div', { class: 'stack-sm' }, [
      heading,
      emptyState(
        'No DSA import has ever run',
        `/dsa is still topic level: the 474 problem names are not on file, so there is nothing to tick problem by problem. ${runLine(commands, OPS_LABEL.dsa)}`
      ),
      dsaImports?.note ? el('p', { class: 'text-sm muted measure', text: dsaImports.note }) : null,
    ]);
  }

  return el('div', { class: 'stack-sm' }, [
    heading,
    el('p', {
      class: 'measure',
      text: `The last import ran on ${whenLabel(last.created_at)} from ${last.source_name}. ${int(last.rows_read)} rows read, ${int(last.rows_written)} written. Easy ${int(last.easy_count)}, medium ${int(last.medium_count)}, hard ${int(last.hard_count)}.`,
    }),
    el('p', {
      class: 'text-sm',
      text:
        Number(last.dry_run) === 1
          ? 'That was a dry run, so it reported what it would do and wrote nothing.'
          : 'That was not a dry run, so those rows were written.',
    }),
    real
      ? null
      : el('p', {
          class: 'measure',
          text: 'Every import on record is a dry run, so no problem has been written and /dsa is still topic level.',
        }),
    dsaImports?.note ? el('p', { class: 'text-sm muted measure', text: dsaImports.note }) : null,
  ]);
}

function commandsBlock(commands) {
  return el('div', { class: 'stack-sm' }, [
    el('p', { class: 'card__label', text: 'The runbook' }),
    (commands ?? []).length
      ? table({
          columns: [
            { key: 'label', label: 'What it does' },
            { key: 'command', label: 'What to run', render: (c) => el('span', { class: 'mono', text: c.command }) },
          ],
          rows: commands,
        })
      : emptyState('No commands were reported', 'GET /api/ops returned an empty command list, so there is no runbook to show.'),
  ]);
}

function opsSection(ops) {
  const commands = ops?.commands ?? [];
  return section(
    'What has actually run',
    [
      el('p', {
        class: 'measure',
        text: 'These rows are written by the scripts themselves. If a script has never run, this says so rather than implying the work is covered.',
      }),
      backupsBlock(ops?.backups, commands),
      linkCheckBlock(ops?.link_check, commands),
      dsaImportBlock(ops?.dsa_imports, commands),
      commandsBlock(commands),
    ],
    { lede: 'From GET /api/ops. Nothing on this screen runs a script: these are the commands to run yourself.' }
  );
}

/* ------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/me');
    const user = d.user ?? {};
    const profile = d.profile ?? null;
    const settings = d.settings ?? { notify_blocks: [] };

    mount('#pf-form', [
      identityCard(user, profile),
      profileForm(user, profile, d.timezone),
      settingsCard(settings),
    ]);
    mount('#pf-links', [linksForm(profile)]);
    mount('#pf-github', [githubCard(profile)]);
    mount('#pf-password', [passwordCard()]);

    // The operational record is a second read and it sits below the export links.
    // It is fetched inside its own boundary because it is the one panel on this
    // screen that depends on rows a script may never have written, and a failure
    // there must not take the profile, the links and the password with it.
    const opsHost = el('div', { class: 'stack' }, [loadingCard('Loading what has actually run.')]);
    mount('#pf-data', [dataCard(settings), opsHost]);
    try {
      opsHost.replaceChildren(opsSection(await api.get('/api/ops')));
    } catch (err) {
      opsHost.replaceChildren(errorCard(err.message));
    }
  } catch (err) {
    mount('#pf-form', errorCard(err.message));
    mount('#pf-links', []);
    mount('#pf-github', []);
    mount('#pf-password', []);
    mount('#pf-data', []);
  }
}

await main();
