import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Providers } from '../providers';

/**
 * Client Providers only wrap app/auth routes — not `/` — so the marketing
 * homepage can statically render without BAILOUT_TO_CLIENT_SIDE_RENDERING.
 */
export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Providers>{children}</Providers>
    </Suspense>
  );
}
