'use client';

import { useEffect, useState, type ReactNode } from 'react';

type ChartEnhanceClientProps = {
  slotId: string;
  children: ReactNode;
  className?: string;
};

/**
 * Client chart layer for a ChartEnhanceSlot. Marks the slot ready after mount
 * so the SSR SVG layer can fade out while the interactive chart takes over.
 */
export function ChartEnhanceClient({ slotId, children, className }: ChartEnhanceClientProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div
      className={className ?? 'chart-enhance-slot__client'}
      data-chart-slot={slotId}
      data-chart-enhanced={ready ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
