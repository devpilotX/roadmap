'use client';

/**
 * BottomBar | five destinations, for a thumb on a 375px screen.
 *
 * Everything else stays one tap away through the command palette, so the thumb
 * reach stays honest.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOTTOM_NAV, isActive } from '@/lib/nav';
import { Icon } from './Icon';

export function BottomBar() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="bottombar" aria-label="Main navigation, compact">
      {BOTTOM_NAV.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            className="bottombar__link"
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            <Icon path={item.icon} className="bottombar__icon" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomBar;
