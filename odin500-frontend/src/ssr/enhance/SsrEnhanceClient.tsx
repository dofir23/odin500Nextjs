'use client';

import { useEffect, type ReactNode } from 'react';

type SsrEnhanceClientProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Marks the document when the client page layer is ready so SSR primary content
 * can be visually replaced (content stays in DOM for crawlers).
 */
export function SsrEnhanceClient({ children, className }: SsrEnhanceClientProps) {
  useEffect(() => {
    document.documentElement.dataset.ssrEnhanced = 'true';
    return () => {
      delete document.documentElement.dataset.ssrEnhanced;
    };
  }, []);

  return <div className={className ?? 'ssr-enhance-page__client'}>{children}</div>;
}
