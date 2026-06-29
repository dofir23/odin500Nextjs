'use client';

import { RoutePageSkeleton } from './RoutePageSkeleton.jsx';

/** Route transition shell — page-shaped skeleton so layout matches the destination route. */
export function PageRouteFallback() {
  return (
    <div className="route-page-fallback route-page-fallback--skeleton" role="status" aria-live="polite" aria-label="Loading page">
      <RoutePageSkeleton />
    </div>
  );
}
