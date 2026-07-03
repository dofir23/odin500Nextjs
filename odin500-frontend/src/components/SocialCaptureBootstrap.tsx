'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Puppeteer snapshot mode — hide chrome, help charts render for social captures. */
function SocialCaptureBootstrapInner() {
  const params = useSearchParams();

  useEffect(() => {
    if (params?.get('socialCapture') !== '1') return;
    const root = document.documentElement;
    root.dataset.socialCapture = '1';
    root.dataset.appHydrated = 'true';
  }, [params]);

  return null;
}

export function SocialCaptureBootstrap() {
  return (
    <Suspense fallback={null}>
      <SocialCaptureBootstrapInner />
    </Suspense>
  );
}
