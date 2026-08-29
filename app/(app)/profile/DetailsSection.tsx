'use client';

/**
 * Your details, the identity card and the way the app behaves.
 *
 * The settings panel saves the moment a control changes, so it has no save
 * button. The details panel has one, because a half typed name is not a name.
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { Section } from '@/components/ui/Basics';
import { Field, Switch } from '@/components/ui/Controls';
import { api, ApiError } from '@/lib/client/api';
import { shortDate } from '@/lib/client/format';
import type { MeProfile, MeSettings, MeUser } from './types';

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

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const source = String(name ?? '').trim() || String(email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

/* ------------------------------------------------------------- identity */

function IdentityCard({ user, profile }: { user: MeUser; profile: MeProfile | null }) {
  const meta = [
    user.created_at ? `Account opened ${shortDate(String(user.created_at).slice(0, 10))}` : null,
    user.last_login_at
      ? `last signed in ${shortDate(String(user.last_login_at).slice(0, 10))}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="card stack-sm">
      <div className="avatarrow">
        {profile?.avatar_path ? (
          <div className="avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.avatar_path}
              alt={`${user.display_name ?? 'Your'} avatar`}
              width={64}
              height={64}
            />
          </div>
        ) : (
          <div className="avatar">
            {initialsOf(profile?.full_name ?? user.display_name, user.email)}
          </div>
        )}
        <div>
          <p className="card__title">{user.display_name ?? user.email}</p>
          <p className="text-sm muted">{user.email}</p>
          <p className="text-xs muted">{meta}</p>
        </div>
      </div>
      <p className="field__hint">
        There is no avatar upload here. The circle shows your initials unless avatar_path has been
        set on the profile row directly.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- your details */

function DetailsForm({
  user,
  profile,
  serverTimezone,
  today,
}: {
  user: MeUser;
  profile: MeProfile | null;
  serverTimezone: string | null;
  today: string;
}) {
  const { toastOk, toastError } = useToast();

  const [displayName, setDisplayName] = useState(user.display_name ?? '');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [targetRole, setTargetRole] = useState(profile?.target_role ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  /**
   * The day the roadmap starts for this person.
   *
   * The 150 day window itself cannot move: final.md fixes every date in it and
   * the four gate dates, and `npm run verify` enforces them. What this sets is the
   * day scoring begins. Days inside the window but before it are neutral rather
   * than red, so starting on a Saturday does not open with a failure.
   */
  const [startOn, setStartOn] = useState((profile?.roadmap_start ?? '').slice(0, 10));
  const [savingStart, setSavingStart] = useState(false);

  const startMin =
    (profile?.roadmap_start ?? '2026-08-28') < '2026-08-28' ? undefined : '2026-08-28';

  const startNote = !startOn
    ? 'Pick a date inside the window.'
    : startOn === '2026-08-28'
      ? 'The first day of the window, which is what the plan assumes.'
      : startOn > today
        ? `Days from 28 August up to ${startOn} will be neutral: not green, not red, and no warnings.`
        : `Scoring starts on ${startOn}. Days before it stay neutral.`;

  const saveStart = async () => {
    setSavingStart(true);
    try {
      await api.patch('/api/me/profile', { roadmap_start: startOn });
      toastOk('Start date saved. Every day already on file has been repainted.');
    } catch (err) {
      toastError((err as ApiError).message);
    } finally {
      setSavingStart(false);
    }
  };

  const save = async () => {
    const patch: Record<string, string> = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      target_role: targetRole.trim(),
      timezone: timezone.trim(),
      bio,
    };
    // display_name lives on the users row and the API refuses a blank one, so it
    // is only sent when there is something to send.
    if (displayName.trim()) patch.display_name = displayName.trim();

    setSaving(true);
    try {
      await api.patch('/api/me/profile', patch);
      toastOk('Your details are saved.');
    } catch (err) {
      toastError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Your details"
      lede="Everything here is optional except a display name, which cannot be blank once it exists."
    >
      <div className="grid grid--2">
        <Field
          label="Display name"
          hint="What the sidebar and the greeting use."
          htmlFor="pf-display-name"
        >
          <input
            id="pf-display-name"
            className="input"
            type="text"
            autoComplete="nickname"
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Full name" hint="The name on a CV, if it differs." htmlFor="pf-full-name">
          <input
            id="pf-full-name"
            className="input"
            type="text"
            autoComplete="name"
            maxLength={160}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor="pf-phone">
          <input
            id="pf-phone"
            className="input"
            type="tel"
            autoComplete="tel"
            maxLength={32}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="City" htmlFor="pf-city">
          <input
            id="pf-city"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>
        <Field
          label="Target role code"
          hint="A role code from the seven roles, eight characters at most."
          htmlFor="pf-target-role"
        >
          <input
            id="pf-target-role"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={8}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
        </Field>
        <Field
          label="Timezone"
          hint={`Every date in this app is worked out in ${
            serverTimezone ?? 'the server timezone'
          }. Changing this does not move the clock.`}
          htmlFor="pf-timezone"
        >
          <input
            id="pf-timezone"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={64}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Bio"
        hint="Two or three sentences. This is not a personal statement."
        htmlFor="pf-bio"
      >
        <textarea
          id="pf-bio"
          className="textarea"
          rows={4}
          maxLength={2000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </Field>

      <div className="row">
        <button type="button" className="btn btn--primary" disabled={saving} onClick={save}>
          Save these details
        </button>
      </div>

      <div className="card__foot stack-sm">
        <p className="card__label">The day the roadmap starts for you</p>
        <p className="text-sm muted measure">
          The 150 day window runs 28 August 2026 to 24 January 2027 and cannot move: final.md fixes
          every date in it, including the four gate dates, and the seed verifier enforces them. What
          you can move is the day scoring begins. Days inside the window but before it are neutral,
          so they never break a streak, never count as red, and raise no warning.
        </p>
        <div className="row">
          <input
            className="input"
            type="date"
            aria-label="The day the roadmap starts for you"
            value={startOn}
            min={startMin}
            max="2027-01-24"
            onChange={(e) => setStartOn(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--sm"
            disabled={savingStart}
            onClick={saveStart}
          >
            Set the start date
          </button>
        </div>
        <p className="field__hint">{startNote}</p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------ how it behaves */

function SettingsCard({ settings }: { settings: MeSettings }) {
  const { toastOk, toastError } = useToast();

  const [theme, setTheme] = useState(settings.theme);
  const [calendarView, setCalendarView] = useState(settings.calendar_view);
  const [blocks, setBlocks] = useState<string[]>(settings.notify_blocks ?? []);
  const [gates, setGates] = useState(Boolean(settings.notify_gates));
  const [pending, setPending] = useState<string | null>(null);

  const changeTheme = async (want: string) => {
    const before = document.documentElement.dataset.theme || 'system';
    setTheme(want);
    document.documentElement.dataset.theme = want;
    try {
      await api.patch('/api/me/settings', { theme: want });
      toastOk('Theme saved.');
    } catch (err) {
      document.documentElement.dataset.theme = before;
      setTheme(before);
      toastError((err as ApiError).message);
    }
  };

  const changeCalendar = async (want: string) => {
    const before = calendarView;
    setCalendarView(want);
    try {
      await api.patch('/api/me/settings', { calendar_view: want });
      toastOk('Calendar view saved.');
    } catch (err) {
      setCalendarView(before);
      toastError((err as ApiError).message);
    }
  };

  const toggleBlock = async (code: string, want: boolean) => {
    const before = blocks;
    const next = want ? [...blocks.filter((c) => c !== code), code] : blocks.filter((c) => c !== code);
    setBlocks(next);
    setPending(code);
    try {
      await api.patch('/api/me/settings', { notify_blocks: next });
    } catch (err) {
      setBlocks(before);
      toastError((err as ApiError).message);
    } finally {
      setPending(null);
    }
  };

  const toggleGates = async (want: boolean) => {
    setGates(want);
    setPending('gates');
    try {
      await api.patch('/api/me/settings', { notify_gates: want });
    } catch (err) {
      setGates(!want);
      toastError((err as ApiError).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Section
      title="How the app behaves"
      lede="These save the moment you change them. There is no separate save button."
    >
      <div className="grid grid--2">
        <Field label="Theme" htmlFor="pf-theme">
          <select
            id="pf-theme"
            className="select"
            aria-label="Theme"
            value={theme}
            onChange={(e) => void changeTheme(e.target.value)}
          >
            {THEMES.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Calendar opens on" htmlFor="pf-calendar-view">
          <select
            id="pf-calendar-view"
            className="select"
            aria-label="Default calendar view"
            value={calendarView}
            onChange={(e) => void changeCalendar(e.target.value)}
          >
            {CALENDAR_VIEWS.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="card__label">Nudge me at the start of these blocks</p>
      <div className="stack-sm">
        {BLOCKS.map((b) => (
          <Switch
            key={b.code}
            checked={blocks.includes(b.code)}
            disabled={pending === b.code}
            onChange={(want) => void toggleBlock(b.code, want)}
            label={
              <span className="stack-sm">
                <span className="text-sm">{b.label}</span>
              </span>
            }
          />
        ))}
      </div>

      <Switch
        checked={gates}
        disabled={pending === 'gates'}
        onChange={(want) => void toggleGates(want)}
        label={
          <span className="stack-sm">
            <span className="text-sm">Remind me about gates</span>
            <span className="field__hint">
              The four gates are fixed dates. This does not move them.
            </span>
          </span>
        }
      />
    </Section>
  );
}

/* ----------------------------------------------------------------- host */

export function DetailsSection({
  user,
  profile,
  settings,
  serverTimezone,
  today,
}: {
  user: MeUser;
  profile: MeProfile | null;
  settings: MeSettings;
  serverTimezone: string | null;
  today: string;
}) {
  return (
    <>
      <IdentityCard user={user} profile={profile} />
      <DetailsForm
        user={user}
        profile={profile}
        serverTimezone={serverTimezone}
        today={today}
      />
      <SettingsCard settings={settings} />
    </>
  );
}

export default DetailsSection;
