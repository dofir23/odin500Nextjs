'use client';

import { RoutePageSkeleton } from '@/components/RoutePageSkeleton';

/** Soft-nav fallback for auth routes (login/signup) while the next page resolves. */
export default function AuthLoading() {
  return <RoutePageSkeleton pathname="/login" />;
}
