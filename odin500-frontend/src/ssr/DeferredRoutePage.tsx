import { Suspense, type ReactNode } from 'react';
import { RoutePageSkeleton } from '@/components/RoutePageSkeleton';

/**
 * Soft navigation must not wait on market SSR fetches.
 * Parent page only resolves params, then streams `children` (async server work)
 * inside Suspense so the URL/chrome update immediately.
 */
export function DeferredRoutePage({
  pathname,
  children
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<RoutePageSkeleton pathname={pathname} />}>
      {children}
    </Suspense>
  );
}
