/**
 * Table.tsx | one table renderer, used by every screen that shows rows.
 *
 * A column either names a key or supplies a render function. Numeric columns get
 * right alignment and tabular figures, so a column of numbers can be compared by
 * eye without reading each one.
 */

import type { ReactNode } from 'react';

export interface Column<T> {
  key?: keyof T & string;
  label: string;
  /** Right aligned, tabular figures, never wrapped. */
  num?: boolean;
  render?: (row: T, index: number) => ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  caption?: ReactNode;
  /** Extra classes for one row, for example a tone. */
  rowClass?: (row: T, index: number) => string | undefined;
  /** Marks the row the reader is currently at. */
  rowCurrent?: (row: T, index: number) => boolean;
  rowKey?: (row: T, index: number) => string | number;
  fixed?: boolean;
}

export function Table<T extends Record<string, any>>({
  columns,
  rows,
  caption,
  rowClass,
  rowCurrent,
  rowKey,
  fixed = false,
}: TableProps<T>) {
  return (
    <div className="tablewrap">
      <table className={`table${fixed ? ' table--fixed' : ''}`}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className={c.num ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey ? rowKey(row, i) : i}
              className={rowClass?.(row, i) || undefined}
              aria-current={rowCurrent?.(row, i) ? 'true' : undefined}
            >
              {columns.map((c) => {
                const value = c.render ? c.render(row, i) : c.key ? row[c.key] : null;
                return (
                  <td key={c.label} className={c.num ? 'num' : undefined}>
                    {value === null || value === undefined ? '' : (value as ReactNode)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
