/**
 * Charts.tsx | plan against actual, bars, and the 150 day grid.
 *
 * There is no chart library here on purpose. Every chart is SVG built from
 * numbers, with an accessible summary beside it, because a chart nobody can read
 * with a screen reader is decoration.
 */

import { int } from '@/lib/client/format';

/* -------------------------------------------------------------- line chart */

export interface LinePoint {
  label: string;
  plan: number;
  actual: number | null;
}

export function LineChart({
  points,
  height = 200,
  yLabel = '',
  summary = '',
}: {
  points: LinePoint[];
  height?: number;
  yLabel?: string;
  summary?: string;
}) {
  const w = 720;
  const h = height;
  const padL = 42;
  const padR = 12;
  const padT = 12;
  const padB = 26;

  const maxY = Math.max(1, ...points.map((p) => Math.max(p.plan ?? 0, p.actual ?? 0)));
  const x = (i: number) => padL + (i * (w - padL - padR)) / Math.max(1, points.length - 1);
  const y = (v: number | null) => h - padB - ((v ?? 0) / maxY) * (h - padT - padB);

  const planPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`)
    .join(' ');

  let actualPath = '';
  let started = false;
  points.forEach((p, i) => {
    if (p.actual === null || p.actual === undefined) return;
    actualPath += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.actual).toFixed(1)} `;
    started = true;
  });
  const lastActual = points.reduce(
    (acc, p, i) => (p.actual !== null && p.actual !== undefined ? i : acc),
    -1
  );

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={summary || 'Plan against actual'}
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((g) => {
          const gy = padT + (g * (h - padT - padB)) / 4;
          return (
            <g key={g}>
              <line className="chart__grid" x1={padL} y1={gy} x2={w - padR} y2={gy} />
              <text className="chart__axis" x={4} y={gy + 3}>
                {Math.round(maxY - (g * maxY) / 4)}
              </text>
            </g>
          );
        })}

        <path className="chart__plan" d={planPath} />
        {actualPath ? <path className="chart__actual" d={actualPath.trim()} /> : null}
        {lastActual >= 0 ? (
          <circle
            className="chart__dot"
            cx={x(lastActual)}
            cy={y(points[lastActual].actual)}
            r={3.5}
          />
        ) : null}

        {points.map((p, i) => {
          if (points.length > 12 && i % 3 !== 0 && i !== points.length - 1) return null;
          return (
            <text key={p.label} className="chart__axis" x={x(i)} y={h - 8} textAnchor="middle">
              {p.label}
            </text>
          );
        })}
      </svg>

      <div className="legend">
        <span className="legend__key">
          <span className="legend__swatch legend__swatch--plan" />
          Plan
        </span>
        <span className="legend__key">
          <span className="legend__swatch" />
          Actual
        </span>
        {yLabel ? <span className="legend__key">{yLabel}</span> : null}
      </div>
      {summary ? <p className="text-xs muted">{summary}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- bar chart */

export interface Bar {
  label: string;
  value: number;
  tone?: 'green' | 'orange' | 'red' | 'muted';
  bandLow?: number;
  bandHigh?: number;
}

export function BarChart({
  bars,
  height = 190,
  summary = '',
  valueFormat = (v: number) => int(v),
}: {
  bars: Bar[];
  height?: number;
  summary?: string;
  valueFormat?: (v: number) => string;
}) {
  const w = 720;
  const h = height;
  const padL = 46;
  const padR = 10;
  const padT = 10;
  const padB = 28;

  const maxY = Math.max(1, ...bars.map((b) => Math.max(b.value ?? 0, b.bandHigh ?? 0)));
  const innerW = w - padL - padR;
  const slot = innerW / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(30, slot * 0.6));
  const y = (v: number | undefined) => h - padB - ((v ?? 0) / maxY) * (h - padT - padB);

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={summary || 'Bar chart'}
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((g) => {
          const gy = padT + (g * (h - padT - padB)) / 4;
          return (
            <g key={g}>
              <line className="chart__grid" x1={padL} y1={gy} x2={w - padR} y2={gy} />
              <text className="chart__axis" x={4} y={gy + 3}>
                {valueFormat(Math.round(maxY - (g * maxY) / 4))}
              </text>
            </g>
          );
        })}

        {bars.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          return (
            <g key={`${b.label}-${i}`}>
              {b.bandLow !== undefined && b.bandHigh !== undefined ? (
                <rect
                  className="chart__band"
                  x={cx - barW / 2 - 3}
                  y={y(b.bandHigh)}
                  width={barW + 6}
                  height={Math.max(1, y(b.bandLow) - y(b.bandHigh))}
                  rx={2}
                />
              ) : null}
              <rect
                className={`chart__bar${b.tone ? ` chart__bar--${b.tone}` : ''}`}
                x={cx - barW / 2}
                y={y(b.value)}
                width={barW}
                height={Math.max(0, h - padB - y(b.value))}
                rx={2}
              />
              {bars.length <= 24 ? (
                <text className="chart__axis" x={cx} y={h - 8} textAnchor="middle">
                  {b.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {summary ? <p className="text-xs muted">{summary}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------- contribution grid */

export interface GridCell {
  pushes?: number;
  commits?: number;
  repos?: string[];
  [key: string]: any;
}

/**
 * The 150 day grid. Weeks run down the columns, weekdays across the rows, which
 * is the shape a GitHub contribution graph uses and the shape people expect.
 */
export function ContributionGrid({
  from,
  to,
  byDate,
  today,
  colourFor,
  describe,
}: {
  from: string;
  to: string;
  byDate: Map<string, GridCell>;
  today: string;
  colourFor: (info: GridCell | undefined, date: string) => string;
  describe?: (info: GridCell | undefined, date: string) => string;
}) {
  const cell = 13;
  const gap = 3;

  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }

  const firstIdx = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const columns = Math.ceil((dates.length + firstIdx) / 7);
  const w = columns * (cell + gap) + 30;
  const h = 7 * (cell + gap) + 18;

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const defaultDescribe = (info: GridCell | undefined, date: string) =>
    info
      ? `${date}: ${info.commits ?? 0} commits across ${info.pushes ?? 0} pushes${
          info.repos ? ` in ${info.repos.join(', ')}` : ''
        }`
      : `${date}: no push`;

  return (
    <svg
      className="chart heatgrid"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${dates.length} day grid from ${from} to ${to}`}
    >
      {DAYS.map((label, i) => (
        <text key={`${label}-${i}`} className="chart__axis" x={0} y={i * (cell + gap) + cell}>
          {label}
        </text>
      ))}

      {dates.map((date, i) => {
        const slot = i + firstIdx;
        const col = Math.floor(slot / 7);
        const row = slot % 7;
        const info = byDate.get(date);
        const isToday = date === today;
        return (
          <g key={date}>
            <rect
              x={22 + col * (cell + gap)}
              y={row * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              className={`heatcell ${colourFor(info, date)}${isToday ? ' heatcell--today' : ''}`}
              strokeWidth={isToday ? 2 : undefined}
              data-date={date}
            />
            <title>{(describe ?? defaultDescribe)(info, date)}</title>
          </g>
        );
      })}
    </svg>
  );
}
