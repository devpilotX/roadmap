import type { Metadata } from 'next';
import { ErrorPage } from '@/components/ErrorPage';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <ErrorPage
      status={404}
      heading="That page does not exist"
      message="Every screen in this app is in the sidebar. Pick one and carry on."
    />
  );
}
