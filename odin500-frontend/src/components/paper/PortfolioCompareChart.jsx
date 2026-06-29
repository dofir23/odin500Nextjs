'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown } from 'lucide-react';
import { createChart } from 'lightweight-charts';import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import {
  PAPER_CHART_COLORS,
  filterHistoryByRange,
  historyToChartPoints,
  rebaseToHundred,
  dedupeAscendingPoints
} from '../../utils/paperPerformanceUtils.js';

const CHART_HEIGHT = 280;

function chartOptionsForTheme(theme, width) {
  const light = theme === 'light';
  return {
    width,
    height: CHART_HEIGHT,
    layout: {
      background: { color: 'transparent' },
      textColor: light ? '#64748b' : '#94a3b8',
      attributionLogo: false
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: light ? '#e2e8f0' : 'rgba(148, 163, 184, 0.12)' }
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false }
  };
}

/**
 * @param {{
 *   accounts: Array<{ account_id: string, name: string, history: Array<{ snapshot_at: string, equity: number }> }>,
 *   allAccounts?: Array<{ id: string, name: string }>,
 *   loading?: boolean
 * }} props
 */
export function PortfolioCompareChart({ accounts = [], allAccounts = [], loading = false }) {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const pickerRef = useRef(null);
  const [range] = useState('6M');
  const [activeIds, setActiveIds] = useState(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  const accountPool = useMemo(() => {
    const histById = new Map((accounts || []).map((a) => [a.account_id, a]));
    const seen = new Set();
    const pool = [];

    for (const row of allAccounts || []) {
      const id = String(row.id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const hist = histById.get(id);
      pool.push({
        id,
        name: row.name || hist?.name || 'Account',
        history: hist?.history || []
      });
    }

    for (const acct of accounts || []) {
      const id = String(acct.account_id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      pool.push({
        id,
        name: acct.name || 'Account',
        history: acct.history || []
      });
    }

    return pool;
  }, [accounts, allAccounts]);

  const colorById = useMemo(() => {
    const map = new Map();
    accountPool.forEach((acct, idx) => {
      map.set(acct.id, PAPER_CHART_COLORS[idx % PAPER_CHART_COLORS.length]);
    });
    return map;
  }, [accountPool]);

  useEffect(() => {
    const ids = accountPool.map((a) => a.id).filter(Boolean);
    if (!ids.length) {
      setActiveIds(new Set());
      return;
    }
    setActiveIds((prev) => {
      const kept = ids.filter((id) => prev.has(id));
      if (kept.length) return new Set(kept);
      return new Set(ids);
    });
  }, [accountPool]);

  const seriesData = useMemo(() => {
    return accountPool
      .filter((acct) => activeIds.has(acct.id))
      .map((acct) => {
        const filtered = filterHistoryByRange(acct.history || [], range);
        const pts = rebaseToHundred(historyToChartPoints(filtered));
        return {
          id: acct.id,
          name: acct.name,
          color: colorById.get(acct.id) || PAPER_CHART_COLORS[0],
          points: pts
        };
      });
  }, [accountPool, activeIds, range, colorById]);

  const activeSeries = seriesData.filter((s) => s.points.length >= 2);
  const activeChips = seriesData;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || activeSeries.length === 0) return undefined;

    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 600));
    for (const s of activeSeries) {
      const line = chart.addLineSeries({
        color: s.color,
        lineWidth: 2,
        priceLineVisible: false,
        title: s.name
      });
      line.setData(dedupeAscendingPoints(s.points));
    }
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: hostRef.current.clientWidth });
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [theme, activeSeries]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  function toggleAccount(id) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function removeAccount(id) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const pickerLabel =
    activeIds.size === accountPool.length
      ? `All portfolios (${activeIds.size})`
      : `${activeIds.size} of ${accountPool.length} selected`;

  return (
    <div className="paper-card paper-compare-chart">
      <div className="paper-card__head paper-compare-chart__head">
        <div className="paper-compare-chart__head-text">
          <h2 className="paper-card__title">Compare performance</h2>
          <p className="paper-chart-card__hint">
            Each line starts at 100 for the selected period so you can see who is ahead, regardless of account size.
          </p>
        </div>
        {accountPool.length > 0 ? (
          <div className="paper-compare-chart__picker-dd" ref={pickerRef}>
            <button
              type="button"
              className={'paper-compare-chart__picker-btn' + (pickerOpen ? ' paper-compare-chart__picker-btn--open' : '')}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((v) => !v)}
            >
              <span className="paper-compare-chart__picker-btn-label">{pickerLabel}</span>
              <ChevronDown className="paper-compare-chart__picker-chev" aria-hidden />
            </button>
            {pickerOpen ? (
              <div className="paper-compare-chart__picker-menu" role="listbox" aria-label="Select portfolios">
                {accountPool.map((acct) => {
                  const color = colorById.get(acct.id) || PAPER_CHART_COLORS[0];
                  const checked = activeIds.has(acct.id);
                  return (
                    <label
                      key={acct.id}
                      className="paper-compare-picker__row"
                      style={{ ['--paper-compare-accent']: color }}
                      role="option"
                      aria-selected={checked}
                    >
                      <input
                        type="checkbox"
                        className="paper-compare-picker__check"
                        checked={checked}
                        onChange={() => toggleAccount(acct.id)}
                        aria-label={`Show ${acct.name} on chart`}
                      />
                      <span className="paper-compare-picker__dot" style={{ background: color }} aria-hidden />
                      <span className="paper-compare-picker__name">{acct.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeChips.length > 0 ? (
        <div className="paper-compare-chart__chips-row">
          <div className="paper-compare-chart__chips" role="group" aria-label="Portfolios on chart">
            {activeChips.map((s) => (
              <div key={s.id} className="paper-compare-chip-card">
                <div className="paper-compare-chip-card__main">
                  <span className="paper-compare-chip-card__label">{s.name}</span>
                  <button
                    type="button"
                    className="paper-compare-chip-card__x"
                    aria-label={`Remove ${s.name} from chart`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeAccount(s.id);
                    }}
                  >
                    ×
                  </button>
                </div>
                <span className="paper-compare-chip-card__bar" style={{ background: s.color }} aria-hidden />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="paper-card__body">
        {loading ? (
          <div className="paper-skeleton paper-chart-host" style={{ minHeight: CHART_HEIGHT }} aria-busy="true" />
        ) : activeSeries.length === 0 ? (
          <div className="paper-chart-empty">
            <p className="paper-chart-empty__title">
              {activeIds.size === 0 ? 'No portfolios selected' : 'Not enough history yet'}
            </p>
            <p>
              {activeIds.size === 0
                ? 'Open the portfolios menu above and check one or more accounts to compare.'
                : 'Performance lines appear after snapshots are saved for your accounts. Try again later or select other portfolios.'}
            </p>
          </div>
        ) : (
          <div ref={hostRef} className="paper-chart-host" />
        )}
      </div>
    </div>
  );
}
