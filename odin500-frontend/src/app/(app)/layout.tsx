import type { ReactNode } from 'react';
import { Providers } from '../providers';

/**
 * Client Providers only wrap app/auth routes — not `/` — so the marketing
 * homepage can statically render without BAILOUT_TO_CLIENT_SIDE_RENDERING.
 * No Suspense here: it hides async page SSR in `hidden` slots until JS runs.
 */
export default function AppRoutesLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
