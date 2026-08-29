'use client';

/**
 * The person behind the roadmap, and the four things only they can change: their
 * details, their links, their GitHub token and their password.
 *
 * This screen serves Part 18, the tracking contract, and Part 19, the honesty
 * rules. Two of its panels carry a cost that is easy to get wrong and so it is
 * written on the screen rather than left to be discovered.
 *
 * The data panel ends with the operational record from GET /api/ops. A link to an
 * export route only proves the route exists, so the rows the backup, link check
 * and import scripts write are read back here. When a script has never run that is
 * stated, with the command, rather than left to look like it is handled.
 *
 * Source: GET /api/me, then GET /api/ops in its own boundary.
 */

import { ErrorCard, LoadingCard } from '@/components/ui/Basics';
import { useResource } from '@/components/ui/useResource';
import { DataSection } from './DataSection';
import { DetailsSection } from './DetailsSection';
import { GithubSection } from './GithubSection';
import { LinksSection } from './LinksSection';
import { OpsSection } from './OpsSection';
import { PasswordSection } from './PasswordSection';
import type { MePayload } from './types';

export function ProfileScreen() {
  const { data, error, loading } = useResource<MePayload>('/api/me');

  if (error) {
    return (
      <section className="stack" aria-label="Profile">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (loading || !data) {
    return (
      <>
        <section className="stack" aria-label="Profile">
          <LoadingCard text="Loading profile." />
        </section>
        <section className="stack" aria-label="Your links">
          <LoadingCard text="Loading your links." />
        </section>
        <section className="stack" aria-label="GitHub">
          <LoadingCard text="Loading github." />
        </section>
        <section className="stack" aria-label="Password">
          <LoadingCard text="Loading password." />
        </section>
        <section className="stack" aria-label="Your data">
          <LoadingCard text="Loading your data." />
        </section>
      </>
    );
  }

  const user = data.user;
  const profile = data.profile ?? null;

  return (
    <>
      <section className="stack" aria-label="Profile">
        <DetailsSection
          user={user}
          profile={profile}
          settings={data.settings}
          serverTimezone={data.timezone}
          today={data.today}
        />
      </section>

      <section className="stack" aria-label="Your links">
        <LinksSection profile={profile} />
      </section>

      <section className="stack" aria-label="GitHub">
        <GithubSection profile={profile} />
      </section>

      <section className="stack" aria-label="Password">
        <PasswordSection />
      </section>

      <section className="stack" aria-label="Your data">
        <DataSection settings={data.settings} />
        <OpsSection />
      </section>
    </>
  );
}

export default ProfileScreen;
