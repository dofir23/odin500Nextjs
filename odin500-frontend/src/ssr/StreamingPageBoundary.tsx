import { Suspense, type ReactNode } from 'react';
import { PageRouteFallback } from '@/components/PageRouteFallback.jsx';

/** Streams async server children; fallback is a route-shaped skeleton shell. */
export function StreamingPageBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageRouteFallback />}>{children}</Suspense>;
}
