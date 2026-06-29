import type { ReactNode } from 'react';
import { ChartEnhanceClient } from './ChartEnhanceClient';

type ChartEnhanceSlotProps = {
  /** Stable id for the chart region (used in data attributes). */
  slotId: string;
  /** Server-rendered SVG (or static fallback) in the initial HTML. */
  ssr: ReactNode;
  /** Client chart component — mounts after hydration. */
  enhance: ReactNode;
  className?: string;
  /** Accessible label for the chart region. */
  label?: string;
};

/**
 * SSR + enhance: SVG (or static chart) in HTML, interactive canvas hydrates on top.
 */
export function ChartEnhanceSlot({
  slotId,
  ssr,
  enhance,
  className,
  label = 'Chart'
}: ChartEnhanceSlotProps) {
  return (
    <div
      className={className ?? 'chart-enhance-slot'}
      data-chart-slot={slotId}
      role="region"
      aria-label={label}
    >
      <div className="chart-enhance-slot__ssr">{ssr}</div>
      <ChartEnhanceClient slotId={slotId}>{enhance}</ChartEnhanceClient>
    </div>
  );
}
