/**
 * The sidebar. Six groups, in the order given in build prompt section 15.
 *
 * Icons are inline SVG path data rendered straight into the markup. There is no
 * icon font, no sprite service and no CDN. Every path is drawn on a 24 by 24
 * grid with stroke rendering, so one rule styles all of them.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: readonly NavGroup[] = [
  {
    group: 'Daily',
    items: [
      {
        href: '/',
        label: 'Today',
        icon: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
      },
      { href: '/calendar', label: 'Calendar', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
      {
        href: '/weeks',
        label: 'Weeks',
        icon: 'M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z',
      },
      { href: '/dsa', label: 'DSA', icon: 'M9 8 5 12l4 4M15 8l4 4-4 4' },
    ],
  },
  {
    group: 'Work',
    items: [
      { href: '/projects', label: 'Projects', icon: 'M3 7h7l2 2h9v10H3zM3 7V5h5l2 2' },
      { href: '/gates', label: 'Gates', icon: 'M6 3v18M18 3v18M6 8h12M6 15h12' },
      {
        // Saturday, then Sunday, which is the order the two rituals happen in. The
        // page existed and only the command palette could reach it, so anybody who
        // never learned Ctrl K never found the seven questions at all.
        href: '/review',
        label: 'Review',
        icon: 'M8 4h8v3H8zM5 7h14v14H5zM9 13l1.5 1.5L14 11M9 18h6',
      },
      {
        href: '/sundays',
        label: 'Sundays',
        icon: 'M12 4v2M12 18v2M4 12H2M22 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
      },
      { href: '/library', label: 'Library', icon: 'M4 5h6v14H4zM14 5h6v14h-6zM4 9h6M14 9h6' },
      {
        href: '/pushes',
        label: 'GitHub',
        icon: 'M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 4.5-1.4 4.5-5a4 4 0 0 0-1.1-2.8 3.7 3.7 0 0 0-.1-2.8s-1.1-.3-3.5 1.3a9 9 0 0 0-4.6 0C7.3 3.8 6.2 4.1 6.2 4.1a3.7 3.7 0 0 0-.1 2.8A4 4 0 0 0 5 9.7c0 3.6 1.7 4.7 4.5 5-.6.6-.6 1.2-.5 2V20',
      },
    ],
  },
  {
    group: 'Money',
    items: [
      {
        href: '/money',
        label: 'Money hour',
        icon: 'M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 3 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
      },
    ],
  },
  {
    group: 'Career',
    items: [
      {
        href: '/applications',
        label: 'Applications',
        icon: 'M4 4h10l6 6v10H4zM14 4v6h6M8 14h8M8 17h5',
      },
      { href: '/ladder', label: 'Ladder', icon: 'M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10' },
      {
        href: '/roles',
        label: 'Roles',
        icon: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21c0-4 3.6-6 8-6s8 2 8 6',
      },
      { href: '/eligibility', label: 'Eligibility', icon: 'M4 12l5 5L20 6' },
    ],
  },
  {
    group: 'Future',
    items: [
      { href: '/after', label: 'After Jan 2027', icon: 'M5 12h14M13 6l6 6-6 6' },
      {
        href: '/newzealand',
        label: 'New Zealand',
        icon: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7ZM12 6.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5Z',
      },
    ],
  },
  {
    group: 'Info',
    items: [
      { href: '/everything', label: 'Everything', icon: 'M4 6h16M4 12h16M4 18h16' },
      { href: '/reference', label: 'Reference', icon: 'M12 3 3 8l9 5 9-5zM3 14l9 5 9-5' },
      {
        // Also reachable from a week's own Print button, but that is one week and
        // this is the chooser, so it belongs with the other things you go and read.
        href: '/print/week',
        label: 'Print a week',
        icon: 'M7 9V4h10v5M7 15H5a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
      },
      { href: '/stats', label: 'Stats', icon: 'M5 20V10M12 20V4M19 20v-7' },
      {
        href: '/profile',
        label: 'Profile',
        icon: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21a7 7 0 0 1 14 0',
      },
    ],
  },
];

/** Five destinations for the bottom bar on a small screen. */
export const BOTTOM_NAV: readonly NavItem[] = [
  {
    href: '/',
    label: 'Today',
    icon: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  },
  { href: '/calendar', label: 'Calendar', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { href: '/dsa', label: 'DSA', icon: 'M9 8 5 12l4 4M15 8l4 4-4 4' },
  {
    href: '/money',
    label: 'Money',
    icon: 'M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 3 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  },
  { href: '/everything', label: 'All', icon: 'M4 6h16M4 12h16M4 18h16' },
];

/** Flat list of every navigable page path, used by the smoke test and the sitemap. */
export const NAV_PATHS: readonly string[] = NAV.flatMap((g) => g.items.map((i) => i.href));

/** True when the sidebar item should render as the current page. */
export function isActive(href: string, path: string): boolean {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}
