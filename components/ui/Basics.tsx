/**
 * Basics.tsx | the presentational primitives every screen shares.
 *
 * These are the React equivalents of the old render.mjs helpers. They are server
 * safe: nothing here uses a hook or the browser, so a screen can render its
 * static half on the server and only make the interactive parts a client island.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { Fill } from './Fill';
import { clampPct } from '@/lib/client/format';

/* --------------------------------------------------------------- page head */

export function PageHead({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="between">
        <h2 className="page-head__title">{title}</h2>
        {actions}
      </div>
      {lede ? <p className="page-head__lede">{lede}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- card */

export function Card({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`card ${className}`.trim()} id={id}>
      {children}
    </div>
  );
}

/** A card with a heading, an optional lede and optional actions on the right. */
export function Section({
  title,
  children,
  lede,
  actions,
  id,
  className = 'card stack',
}: {
  title: string;
  children: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section className={className} id={id}>
      <div className="card__head">
        <h2 className="card__title">{title}</h2>
        {actions}
      </div>
      {lede ? <p className="muted text-sm">{lede}</p> : null}
      {children}
    </section>
  );
}

/** A label above a verbatim quotation from final.md. */
export function Verbatim({ title, text }: { title: string; text: ReactNode }) {
  return (
    <div className="card">
      <p className="card__label">{title}</p>
      <p className="measure">{text}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- callout */

export type Tone = 'red' | 'orange' | 'green' | 'blue' | 'plain';

const CALLOUT_ICON: Record<Tone, string> = {
  red: 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01',
  orange: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  green: 'M4 12l5 5L20 6',
  blue: 'M12 8h.01M11 12h1v5h1',
  plain: 'M12 8h.01M11 12h1v5h1',
};

export function Callout({
  tone = 'plain',
  title,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`callout${tone === 'plain' ? '' : ` callout--${tone}`}`}>
      <Icon path={CALLOUT_ICON[tone]} className="callout__icon" />
      <div className="callout__body">
        {title ? <p className="callout__title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ empty, load */

/** A written empty state, never a blank panel. */
export function EmptyState({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <p className="empty__body">{body}</p>
    </div>
  );
}

export function LoadingCard({ text = 'Loading.' }: { text?: string }) {
  return (
    <div className="card">
      <p className="muted">{text}</p>
    </div>
  );
}

/**
 * One named loading card per section, which is what every EJS view seeded.
 *
 * It matters more than it looks. A screen with four panels used to say which four
 * were coming and what each one was, so a slow query showed a page taking shape
 * rather than a single word. Collapsing that to one card loses information the
 * person was given before.
 */
export function LoadingSections({
  sections,
}: {
  sections: { label: string; text: string; className?: string }[];
}) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.label} className={s.className ?? 'stack'} aria-label={s.label}>
          <LoadingCard text={s.text} />
        </section>
      ))}
    </>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <Callout tone="red" title="That did not load">
      <p>{message}</p>
    </Callout>
  );
}

/* ----------------------------------------------------------------- badges */

export function Badge({
  tone,
  children,
  dot = false,
  title,
}: {
  tone?: 'green' | 'orange' | 'red' | 'blue' | 'outline';
  children: ReactNode;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge${tone ? ` badge--${tone}` : ''}`} title={title}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** The badge for a day colour, with its fixed meaning. */
export function ColourBadge({ colour }: { colour: string | null | undefined }) {
  const map: Record<string, { tone: 'green' | 'orange' | 'red' | 'outline'; label: string }> = {
    green: { tone: 'green', label: 'Green day' },
    amber: { tone: 'orange', label: 'Amber day' },
    red: { tone: 'red', label: 'Red day' },
    neutral: { tone: 'outline', label: 'Neutral, rest Sunday' },
  };
  const hit = map[String(colour)] ?? map.red;
  return (
    <Badge tone={hit.tone} dot>
      {hit.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ stats */

export interface StatSpec {
  value: string | number;
  label: string;
  sub?: ReactNode;
  tone?: 'green' | 'orange' | 'red' | 'blue';
  hero?: boolean;
  large?: boolean;
}

export function Stat({ value, label, sub, tone, hero, large }: StatSpec) {
  const size = hero ? ' stat__value--hero' : large ? ' stat__value--lg' : '';
  return (
    <div className={`card stat${tone ? ` stat--${tone}` : ''}`}>
      <span className={`stat__value${size}`}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : (value ?? '-')}
      </span>
      <span className="stat__label">{label}</span>
      {sub ? <span className="stat__sub">{sub}</span> : null}
    </div>
  );
}

export function StatGrid({ stats, columns = 4 }: { stats: StatSpec[]; columns?: 2 | 3 | 4 }) {
  return (
    <div className={`grid grid--${columns}`}>
      {stats.map((s, i) => (
        <Stat key={`${s.label}-${i}`} {...s} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ meter */

export function Meter({
  percent,
  tone,
  thick = false,
  label,
}: {
  percent: number;
  tone?: 'green' | 'orange' | 'red';
  thick?: boolean;
  label?: string;
}) {
  const pct = clampPct(percent);
  return (
    <div
      className={`meter${tone ? ` meter--${tone}` : ''}${thick ? ' meter--thick' : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {/* The width is applied from script, so no style attribute is ever written
       * into the markup. See components/ui/Fill.tsx for why. */}
      <Fill percent={pct} className="meter__fill" />
    </div>
  );
}

/* ------------------------------------------------------------ phase marks */

export function PhaseDot({ code }: { code: string | null | undefined }) {
  const c = String(code ?? '').trim().toLowerCase();
  const cls = /^[a-f]$/.test(c) ? `phase-${c}` : '';
  return <span className={`phasedot ${cls}`.trim()} aria-hidden="true" />;
}

/* --------------------------------------------------------- external links */

/** Every outbound link opens safely. There is no exception anywhere. */
export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      {/* The same glyph the Express build drew: a box with an arrow leaving it. */}
      <Icon
        path="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        className="extlink__icon"
      />
    </a>
  );
}

/** An internal link that looks like a button. */
export function ButtonLink({
  href,
  children,
  className = 'btn btn--sm',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
