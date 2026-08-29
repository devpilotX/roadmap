'use client';

/**
 * Controls.tsx | the interactive primitives.
 *
 * A chip bar, a search box, a tick and a switch. Each one is a controlled
 * component, so the screen that owns the data owns the state.
 */

import type { ReactNode } from 'react';
import { Icon } from '../Icon';

/* ------------------------------------------------------------- chip filter */

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  count?: number;
}

export function ChipFilter<V extends string>({
  options,
  current,
  onChange,
  label,
}: {
  options: ChipOption<V>[];
  current: V;
  onChange: (value: V) => void;
  label?: string;
}) {
  return (
    <div className="row" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={o.value === current}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? <span className="badge badge--outline">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- searchbox */

export function SearchBox({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="searchbox">
      <Icon path="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4 4" className="searchbox__icon" />
      <input
        className="input searchbox__input"
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- tick */

export function Tick({
  checked,
  onChange,
  label,
  meta,
  disabled = false,
  pending = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <label className={`tick${pending ? ' tick--pending' : ''}`}>
      <input
        type="checkbox"
        className="tick__box"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="tick__body">
        <span className="tick__text">{label}</span>
        {meta ? <span className="tick__meta">{meta}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ switch */

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        className="switch__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A number input that only ever reports a whole number. */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  id,
  label,
  className = 'input input--num',
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  id?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={Number.isFinite(value) ? value : 0}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value));
        onChange(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min);
      }}
    />
  );
}
