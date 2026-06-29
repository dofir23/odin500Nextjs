'use client';
import { DataInfoTip } from './DataInfoTip.jsx';

/** @typedef {import('./chartInfoTips.js').ChartInfoTipContent} ChartInfoTipContent */

/**
 * Info button with three short paragraphs aimed at end users.
 * @param {{ tip: ChartInfoTipContent | null | undefined, align?: 'start' | 'end' }} props
 */
export function ChartInfoTip({ tip, align = 'end' }) {
  if (!tip) return null;
  return (
    <DataInfoTip align={align} ariaLabel="About this chart">
      <p className="ticker-data-tip__p">
        <strong>What you&apos;ll see:</strong> {tip.data}
      </p>
      <p className="ticker-data-tip__p">
        <strong>How it works:</strong> {tip.calculation}
      </p>
      <p className="ticker-data-tip__p">
        <strong>Example:</strong> {tip.example}
      </p>
    </DataInfoTip>
  );
}
