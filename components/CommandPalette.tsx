'use client';

/**
 * CommandPalette | Ctrl K, then type.
 *
 * A week number jumps to that week, an ISO date jumps to that day on the
 * calendar, and anything else matches a screen name.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const PALETTE_BASE: [string, string][] = [
  ['Today', '/'],
  ['Calendar', '/calendar'],
  ['Weeks', '/weeks'],
  ['DSA tracker', '/dsa'],
  ['Projects', '/projects'],
  ['Gates', '/gates'],
  ['Sundays', '/sundays'],
  ['Library', '/library'],
  ['GitHub pushes', '/pushes'],
  ['Money hour', '/money'],
  ['Applications', '/applications'],
  ['Unlock ladder', '/ladder'],
  ['The seven roles', '/roles'],
  ['Eligibility, what can I apply for today', '/eligibility'],
  ['After Jan 2027', '/after'],
  ['New Zealand', '/newzealand'],
  ['Everything A to Z', '/everything'],
  ['Reference', '/reference'],
  ['Stats', '/stats'],
  ['Profile', '/profile'],
  ['Saturday review', '/review'],
  ['Printable week sheet', '/print/week'],
];

function matches(term: string): [string, string][] {
  const t = term.trim().toLowerCase();
  const out: [string, string][] = [];

  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= 21) out.push([`Week ${n}`, `/weeks/${n}`]);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) out.push([`Calendar, ${t}`, `/calendar?date=${t}`]);
  if (!t) return PALETTE_BASE.slice(0, 8);

  for (const [label, href] of PALETTE_BASE) {
    if (label.toLowerCase().includes(t)) out.push([label, href]);
  }
  return out.slice(0, 10);
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => matches(term), [term]);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setIndex(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="modal"
      data-open={open ? '1' : '0'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="palette-label"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__panel">
        <label className="visually-hidden" id="palette-label" htmlFor="palette-input">
          Search screens and jump
        </label>
        <input
          ref={inputRef}
          className="input"
          id="palette-input"
          type="search"
          placeholder="Jump to a screen, a week, or a date"
          autoComplete="off"
          spellCheck={false}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const hit = results[index];
              if (hit) go(hit[1]);
            }
          }}
        />

        <ul className="kancol__list" id="palette-results" role="listbox" aria-labelledby="palette-label">
          {results.map(([label, href], i) => (
            <li key={href}>
              <a
                className={`kancard${i === index ? ' is-active' : ''}`}
                href={href}
                role="option"
                aria-selected={i === index}
                onClick={(e) => {
                  e.preventDefault();
                  go(href);
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <p className="text-xs muted">
          <kbd>Ctrl</kbd> <kbd>K</kbd> opens this. <kbd>Esc</kbd> closes it. Type a week number, a
          date like 2026-10-04, or the name of a screen.
        </p>
      </div>
    </div>
  );
}

export default CommandPalette;
