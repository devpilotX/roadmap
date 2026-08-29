'use client';

/**
 * Your links. A recruiter reads these before they read your CV.
 *
 * The API rejects anything that is not a full http or https URL, so the preview
 * is redrawn from the fresh profile the server returns rather than from what was
 * typed into the boxes.
 */

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { ExternalLink, Section } from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { api, ApiError } from '@/lib/client/api';
import type { MeProfile } from './types';

const ICON = {
  github:
    'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.8a5.3 5.3 0 0 0-1.5-3.6 4.9 4.9 0 0 0-.1-3.7s-1.2-.4-4 1.5a13 13 0 0 0-6.9 0C6 1 4.8 1.4 4.8 1.4a4.9 4.9 0 0 0-.1 3.7A5.3 5.3 0 0 0 3.2 8.7c0 5.3 3.1 6.5 6.1 6.8a3.4 3.4 0 0 0-.9 2.6V22',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
};

function LinkPreview({ profile }: { profile: MeProfile | null }) {
  const rows: [string, string | null, string | null][] = [
    [
      'GitHub',
      profile?.github_user ? `https://github.com/${profile.github_user}` : null,
      profile?.github_user ?? null,
    ],
    ['LinkedIn', profile?.linkedin_url ?? null, profile?.linkedin_url ?? null],
    ['Portfolio', profile?.portfolio_url ?? null, profile?.portfolio_url ?? null],
    ['Site one', profile?.site_1 ?? null, profile?.site_1 ?? null],
    ['Site two', profile?.site_2 ?? null, profile?.site_2 ?? null],
    ['Site three', profile?.site_3 ?? null, profile?.site_3 ?? null],
  ];
  const shown = rows.filter(([, href]) => Boolean(href));

  if (!shown.length) {
    return (
      <p className="muted text-sm">
        No links set yet. A recruiter reads these before they read your CV, so at least the GitHub
        username and one live URL are worth filling in.
      </p>
    );
  }

  return (
    <div className="linklist">
      {shown.map(([label, href, text]) => (
        <div className="linklist__row" key={label}>
          <Icon
            path={label === 'GitHub' ? ICON.github : ICON.link}
            className="linklist__icon"
          />
          <span>
            <span className="muted">{`${label}: `}</span>
            <ExternalLink href={String(href)}>{String(text)}</ExternalLink>
          </span>
        </div>
      ))}
    </div>
  );
}

export function LinksSection({ profile }: { profile: MeProfile | null }) {
  const { toastOk, toastError } = useToast();

  const [shown, setShown] = useState<MeProfile | null>(profile);
  const [githubUser, setGithubUser] = useState(profile?.github_user ?? '');
  const [linkedin, setLinkedin] = useState(profile?.linkedin_url ?? '');
  const [portfolio, setPortfolio] = useState(profile?.portfolio_url ?? '');
  const [site1, setSite1] = useState(profile?.site_1 ?? '');
  const [site2, setSite2] = useState(profile?.site_2 ?? '');
  const [site3, setSite3] = useState(profile?.site_3 ?? '');
  const [upi, setUpi] = useState(profile?.upi_id ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const fresh = await api.patch<MeProfile>('/api/me/profile', {
        github_user: githubUser.trim(),
        linkedin_url: linkedin.trim(),
        portfolio_url: portfolio.trim(),
        site_1: site1.trim(),
        site_2: site2.trim(),
        site_3: site3.trim(),
        upi_id: upi.trim(),
      });
      setShown(fresh);
      toastOk('Your links are saved.');
    } catch (err) {
      toastError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Your links"
      lede="Every URL must start with http:// or https://. A blank field clears the value."
    >
      <div>
        <LinkPreview profile={shown} />
      </div>

      <div className="grid grid--2">
        <Field
          label="GitHub username"
          hint="Just the username. The push sync uses this."
          htmlFor="pf-github-user"
        >
          <input
            id="pf-github-user"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={120}
            placeholder="your-github-username"
            value={githubUser}
            onChange={(e) => setGithubUser(e.target.value)}
          />
        </Field>
        <Field label="LinkedIn" htmlFor="pf-linkedin">
          <input
            id="pf-linkedin"
            className="input"
            type="url"
            placeholder="https://www.linkedin.com/in/you"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
          />
        </Field>
        <Field label="Portfolio" htmlFor="pf-portfolio">
          <input
            id="pf-portfolio"
            className="input"
            type="url"
            placeholder="https://your-site"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
          />
        </Field>
        <Field
          label="UPI ID"
          hint="Used on the money screens when you invoice."
          htmlFor="pf-upi"
        >
          <input
            id="pf-upi"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={120}
            placeholder="you@bank"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
          />
        </Field>
        <Field label="Site one" htmlFor="pf-site-1">
          <input
            id="pf-site-1"
            className="input"
            type="url"
            placeholder="https://project-one"
            value={site1}
            onChange={(e) => setSite1(e.target.value)}
          />
        </Field>
        <Field label="Site two" htmlFor="pf-site-2">
          <input
            id="pf-site-2"
            className="input"
            type="url"
            placeholder="https://project-two"
            value={site2}
            onChange={(e) => setSite2(e.target.value)}
          />
        </Field>
        <Field label="Site three" htmlFor="pf-site-3">
          <input
            id="pf-site-3"
            className="input"
            type="url"
            placeholder="https://project-three"
            value={site3}
            onChange={(e) => setSite3(e.target.value)}
          />
        </Field>
      </div>

      <div className="row">
        <button type="button" className="btn btn--primary" disabled={saving} onClick={save}>
          Save these links
        </button>
      </div>
    </Section>
  );
}

export default LinksSection;
