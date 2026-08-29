'use client';

/**
 * Fill.tsx | a width applied from script, never as a style attribute.
 *
 * The CSP says `style-src-attr 'none'`. That rule is not decoration: it is what
 * stops an injected `style` attribute from being used to reposition or hide part
 * of the interface. The Express build honoured it by rendering `data-fill="63"`
 * and setting the width from JavaScript, and this is the same thing as a React
 * component: the server sends the number as a data attribute, and the width is
 * set on the element after mount.
 *
 * Without JavaScript the bar reads as empty, and the number it represents is
 * always written out beside it in words, which is why that is acceptable.
 */

import { useEffect, useRef, type ReactNode } from 'react';

export interface FillProps {
  /** 0 to 100. Values outside that range are clamped. */
  percent: number;
  className?: string;
  /** A vertical fill, for a bar that grows upwards. */
  axis?: 'width' | 'height';
  /** A hover label, for a segment whose meaning is not written beside it. */
  title?: string;
  children?: ReactNode;
}

export function Fill({
  percent,
  className = '',
  axis = 'width',
  title,
  children,
}: FillProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));

  useEffect(() => {
    ref.current?.style.setProperty(axis, `${pct}%`);
  }, [pct, axis]);

  return (
    <div ref={ref} className={className} data-fill={pct} title={title}>
      {children}
    </div>
  );
}

/** A fixed size square, for a legend swatch. Same reasoning as Fill. */
export function Swatch({ className = '', size = 10 }: { className?: string; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('width', `${size}px`);
    node.style.setProperty('height', `${size}px`);
  }, [size]);

  return <span ref={ref} className={className} aria-hidden="true" />;
}

export default Fill;
