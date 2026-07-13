import { RoutePageSkeleton } from '@/components/RoutePageSkeleton';

/**
 * Instant soft-nav fallback while deferred page SSR streams.
 * Keep this free of client-only location hooks so the boundary paints immediately.
 */
export default function ProtectedLoading() {
  return <RoutePageSkeleton pathname="/market" />;
}
