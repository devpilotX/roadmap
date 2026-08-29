/**
 * The authenticated group.
 *
 * Only the timer lives here, because it has to survive a navigation between
 * screens. The chrome itself is rendered per page by PageShell, which is what
 * lets each screen own its own title and its own reading width.
 */

import { TimerProvider } from '@/components/TimerProvider';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <TimerProvider>{children}</TimerProvider>;
}
