import type { ReactNode } from 'react';
import { FullSsrPage } from './FullSsrPage';

type SsrEnhancePageProps = {
  server: ReactNode;
  enhance: ReactNode;
  className?: string;
};

/** @deprecated Use FullSsrPage */
export function SsrEnhancePage({ server, enhance, className }: SsrEnhancePageProps) {
  return <FullSsrPage server={server} client={enhance} className={className} />;
}
