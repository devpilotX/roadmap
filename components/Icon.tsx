/**
 * Icon | inline SVG from path data.
 *
 * Every icon in the application is one or more paths on a 24 by 24 grid, drawn
 * with stroke rendering. There is no icon font, no sprite service and no CDN.
 */

export interface IconProps {
  /** One path, or several drawn into the same icon. */
  path: string | string[];
  className?: string;
  title?: string;
}

export function Icon({ path, className = 'btn__icon', title }: IconProps) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default Icon;
