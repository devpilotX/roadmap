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

/**
 * Everything inside `root` that a keyboard can land on. Mirrors the helper in
 * components/AccountMenu.tsx, which is the reference for this pattern.
 */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], select, input, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Tab is held inside the panel. This is an aria-modal dialog rendered last in
      // the tree, so without this the first Tab drops into the page behind it, and
      // the page behind it is the one the dialog is covering.
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusables(panel);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  /* The row the arrow keys are on, named so the combobox can point at it. */
  const activeId = results[index] ? `palette-opt-${index}` : undefined;

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
      <div className="modal__panel" ref={panelRef}>
        <label className="visually-hidden" id="palette-label" htmlFor="palette-input">
          Search screens and jump
        </label>
        {/*
          A combobox that owns a listbox, which is what this always was and what it
          now says it is. It used to be a bare role="listbox" holding `<li>` wrappers
          around role="option" anchors: an option may not be the child of anything
          but its own listbox or a group inside it, nothing tied the input to the
          list, and nothing told an assistive technology which row the arrow keys had
          reached. aria-activedescendant is that last part, and it is why focus is
          allowed to stay in the input while the highlight moves.
        */}
        <input
          ref={inputRef}
          className="input"
          id="palette-input"
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="palette-results"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
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

        {results.length ? (
          /*
            The rows are the `<li>` themselves, not anchors inside them, because an
            option may not contain anything focusable. That costs a middle click into
            a new tab; every other way in still works, Enter on the highlighted row
            or a click on any row, and both already went through router.push.
          */
          <ul className="kancol__list" id="palette-results" role="listbox" aria-label="Matches">
            {results.map(([label, href], i) => (
              <li
                key={href}
                id={`palette-opt-${i}`}
                role="option"
                aria-selected={i === index}
                className={`kancard${i === index ? ' is-active' : ''}`}
                onClick={() => go(href)}
              >
                {label}
              </li>
            ))}
          </ul>
        ) : (
          /* Said out loud, because a palette that silently shows nothing looks
             broken rather than empty. */
          <p className="muted" id="palette-results">
            Nothing matches that. Try a week number from 1 to 21, a date like 2026-10-04, or part of
            a screen name.
          </p>
        )}

        <p className="text-xs muted">
          <kbd>Ctrl</kbd> <kbd>K</kbd> opens this. <kbd>Esc</kbd> closes it. Type a week number, a
          date like 2026-10-04, or the name of a screen.
        </p>
      </div>
    </div>
  );
}

export default CommandPalette;
