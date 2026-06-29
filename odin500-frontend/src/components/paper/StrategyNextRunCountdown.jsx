'use client';
import { useEffect, useState } from 'react';
import { formatNextStrategyCheck } from '../../utils/strategySchedule.js';

export function StrategyNextRunCountdown({ lastRunAt, active }) {
  const [label, setLabel] = useState(() => (active ? formatNextStrategyCheck(lastRunAt) : ''));

  useEffect(() => {
    if (!active) {
      setLabel('');
      return undefined;
    }
    function tick() {
      setLabel(formatNextStrategyCheck(lastRunAt));
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [lastRunAt, active]);

  if (!active) return null;
  if (!label) return null;

  return (
    <span className="paper-strategy-panel__next-run">
      {' · Next market check in: '}
      <strong>{label}</strong>
    </span>
  );
}
