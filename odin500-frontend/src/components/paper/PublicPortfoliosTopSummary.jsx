'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { detectAiEngine, detectIndexFocus } from '@/utils/aiPortfolioTags.js';
import { fmtPctSigned } from '@/utils/formatDisplayNumber.js';
import { apiUrl } from '@/utils/apiOrigin.js';
import { PublicPortfolioMiniChart } from './PublicPortfolioMiniChart.jsx';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(v));
}

function toneClass(v) {
  if (Number(v) > 0) return 'text-green-600 dark:text-green-400';
  if (Number(v) < 0) return 'text-red-600 dark:text-red-400';
  return 'text-slate-800 dark:text-slate-100';
}

function ownerInitials(label) {
  const text = String(label || '').trim();
  if (!text) return '?';
  if (text.includes('@')) return text.charAt(0).toUpperCase();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function enrichPortfolio(p) {
  const blob = [p?.name, p?.owner_label, p?.publish_description, p?.publish_strategy]
    .map((x) => String(x || ''))
    .join(' ');
  return {
    ...p,
    ai_engine: detectAiEngine(blob),
    index_focus: detectIndexFocus(blob)
  };
}

/**
 * Prefer publisher text; otherwise synthesize a short blurb from tags + performance.
 */
export function buildPortfolioSummary(p) {
  const desc = String(p?.publish_description || '').trim();
  if (desc) return desc.length > 280 ? `${desc.slice(0, 277).trim()}…` : desc;

  const strategy = String(p?.publish_strategy || '').trim();
  if (strategy) return strategy.length > 280 ? `${strategy.slice(0, 277).trim()}…` : strategy;

  const engine = p?.ai_engine?.label;
  const index = p?.index_focus?.label;
  const auto = p?.strategy_mode && p.strategy_mode !== 'manual';
  const avg = p?.avg_monthly_return_pct;
  const total = p?.total_return_pct;
  const months = p?.months_elapsed;
  const days = p?.days_elapsed;

  const bits = [];
  if (engine && index) {
    bits.push(`${engine}-assisted book focused on the ${index}`);
  } else if (engine) {
    bits.push(`${engine}-assisted virtual portfolio`);
  } else if (index) {
    bits.push(`Virtual portfolio oriented around the ${index}`);
  } else {
    bits.push('Published virtual portfolio on Odin500');
  }

  if (auto) bits.push('with automated trading rules');

  if (total != null && Number.isFinite(Number(total))) {
    bits.push(`with ${fmtPctSigned(total, { decimals: 2 })} total return`);
  }

  const daysN = Number(days);
  if (avg != null && Number.isFinite(Number(avg)) && Number.isFinite(daysN) && daysN >= 14) {
    bits.push(`(${fmtPctSigned(avg, { decimals: 2 })} average monthly)`);
  } else if (Number.isFinite(daysN) && daysN < 30) {
    const d = Math.max(1, Math.round(daysN));
    bits.push(`tracked for about ${d} day${d === 1 ? '' : 's'}`);
  } else if (months != null && Number(months) >= 1) {
    bits.push(`over ~${months} months`);
  }

  return `${bits.join(' ')}.`;
}

export function pickTopPublicPortfolios(portfolios, limit = 3) {
  return [...(portfolios || [])]
    .sort((a, b) => {
      const av = a.avg_monthly_return_pct;
      const bv = b.avg_monthly_return_pct;
      if (av == null && bv == null) {
        return Number(b.total_return_pct || 0) - Number(a.total_return_pct || 0);
      }
      if (av == null) return 1;
      if (bv == null) return -1;
      return Number(bv) - Number(av);
    })
    .slice(0, limit)
    .map(enrichPortfolio);
}

const RANK_LABELS = ['1st', '2nd', '3rd'];

const CARD_BASE =
  'flex max-h-[26rem] min-h-[14rem] flex-col gap-3 rounded-[14px] border px-4 pb-3.5 pt-4 transition duration-150 ease-out hover:-translate-y-0.5';

const CARD_BY_RANK = [
  // 1st
  `${CARD_BASE} border-amber-300/70 bg-gradient-to-br from-amber-50 to-white shadow-sm hover:border-amber-400 hover:shadow-md dark:border-amber-400/35 dark:from-amber-400/10 dark:to-white/[0.02] dark:shadow-none dark:hover:border-amber-400/50 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`,
  // 2nd
  `${CARD_BASE} border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md dark:border-slate-400/35 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-blue-400/40 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`,
  // 3rd
  `${CARD_BASE} border-orange-200/90 bg-gradient-to-br from-orange-50/80 to-white shadow-sm hover:border-orange-300 hover:shadow-md dark:border-orange-500/30 dark:from-orange-500/10 dark:to-white/[0.02] dark:shadow-none dark:hover:border-orange-400/40 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`
];

const RANK_PILL = [
  'border border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200',
  'border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/15 dark:text-slate-200',
  'border border-orange-300/70 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300'
];

const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide';

const BADGE_BY_ENGINE = {
  claude: `${BADGE_BASE} border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300`,
  chatgpt: `${BADGE_BASE} border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300`,
  gemini: `${BADGE_BASE} border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300`
};

const BADGE_INDEX = `${BADGE_BASE} border-violet-300/70 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300`;
const BADGE_DEFAULT = `${BADGE_BASE} border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300`;

const SKEL_CARD =
  'min-h-[11.5rem] pointer-events-none animate-pulse rounded-[14px] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]';

export function PublicPortfoliosTopSummary({ portfolios, loading }) {
  const top = useMemo(() => pickTopPublicPortfolios(portfolios, 3), [portfolios]);
  const topIds = useMemo(() => top.map((p) => p.id).join(','), [top]);
  const [histories, setHistories] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiSummaries, setAiSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!topIds) {
      setHistories({});
      setAiSummaries({});
      return undefined;
    }
    const ids = topIds.split(',').filter(Boolean);
    const payloadRows = top.map((p) => ({
      id: p.id,
      name: p.name,
      owner_label: p.owner_label,
      publish_description: p.publish_description || '',
      publish_strategy: p.publish_strategy || '',
      strategy_mode: p.strategy_mode || 'manual',
      ai_engine_label: p.ai_engine?.label || null,
      index_focus_label: p.index_focus?.label || null,
      equity: p.equity,
      total_return_pct: p.total_return_pct,
      avg_monthly_return_pct: p.avg_monthly_return_pct,
      months_elapsed: p.months_elapsed,
      days_elapsed: p.days_elapsed,
      positions_count: p.positions_count
    }));

    let cancelled = false;
    setHistoryLoading(true);
    setSummaryLoading(true);

    (async () => {
      const historyEntries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(apiUrl(`/api/public/paper/portfolios/${encodeURIComponent(id)}/history`));
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) return [id, []];
            return [id, Array.isArray(payload.history) ? payload.history : []];
          } catch {
            return [id, []];
          }
        })
      );
      if (!cancelled) {
        setHistories(Object.fromEntries(historyEntries));
        setHistoryLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(apiUrl('/api/public/paper/portfolios/ai-summaries'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolios: payloadRows })
        });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && payload?.summaries && typeof payload.summaries === 'object') {
          setAiSummaries(payload.summaries);
        } else {
          setAiSummaries({});
        }
      } catch {
        if (!cancelled) setAiSummaries({});
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // topIds is the stable key; payload is rebuilt from current `top` when ids change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topIds]);

  if (loading) {
    return (
      <section className="mt-5" aria-labelledby="public-top-portfolios-title" aria-busy="true">
        <h2
          id="public-top-portfolios-title"
          className="m-0 text-[1.05rem] font-bold text-slate-900 dark:text-slate-100"
        >
          Top performers
        </h2>
        <div className="mt-3.5 grid list-none grid-cols-1 gap-3.5 p-0 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={SKEL_CARD} />
          ))}
        </div>
      </section>
    );
  }

  if (!top.length) return null;

  return (
    <section className="mt-5" aria-labelledby="public-top-portfolios-title">
      <div className="mb-3.5">
        <h2
          id="public-top-portfolios-title"
          className="m-0 text-[1.05rem] font-bold text-slate-900 dark:text-slate-100"
        >
          Top performers
        </h2>
        <p className="mt-1.5 m-0 text-[0.86rem] leading-snug text-slate-500 dark:text-slate-400">
          Highest average monthly return among published virtual portfolios.
        </p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 lg:grid-cols-3">
        {top.map((p, index) => {
          const href = `/paper-trading/public/${encodeURIComponent(p.id)}`;
          const rank = RANK_LABELS[index] || `${index + 1}th`;
          const summary = aiSummaries[p.id] || (!summaryLoading ? buildPortfolioSummary(p) : '');
          const cardClass = CARD_BY_RANK[index] || CARD_BY_RANK[1];
          const rankClass = RANK_PILL[index] || RANK_PILL[1];
          return (
            <li key={p.id}>
              <article className={cardClass}>
                <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex items-center justify-between gap-2.5">
                    <span
                      className={`inline-flex min-w-[2.35rem] items-center justify-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide ${rankClass}`}
                      aria-label={`Rank ${index + 1}`}
                    >
                      {rank}
                    </span>
                    <span
                      className="inline-flex h-[2.35rem] w-[2.35rem] shrink-0 items-center justify-center rounded-full border border-blue-300/70 bg-blue-50 text-[0.74rem] font-bold tracking-wide text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200"
                      aria-hidden
                    >
                      {ownerInitials(p.owner_label)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                      {p.name}
                    </p>
                    <p className="mt-0.5 m-0 truncate text-sm text-slate-500 dark:text-slate-400">
                      by {p.owner_label}
                    </p>
                    {summaryLoading && !aiSummaries[p.id] ? (
                      <p
                        className="mt-1.5 m-0 text-[0.8rem] italic leading-snug text-slate-400 opacity-80 dark:text-slate-500"
                        aria-busy="true"
                      >
                        Generating summary…
                      </p>
                    ) : summary ? (
                      <p className="mt-1.5 m-0 text-[0.8rem] leading-snug text-slate-600 dark:text-slate-400">
                        {summary}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap gap-1.5 empty:hidden">
                      {p.ai_engine ? (
                        <span className={BADGE_BY_ENGINE[p.ai_engine.id] || BADGE_DEFAULT}>
                          {p.ai_engine.label}
                        </span>
                      ) : null}
                      {p.index_focus ? (
                        <span className={BADGE_INDEX}>{p.index_focus.label}</span>
                      ) : null}
                      {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                        <span className={BADGE_DEFAULT}>Automated</span>
                      ) : null}
                    </div>
                  </div>
                  <dl className="m-0 grid grid-cols-3 gap-2 rounded-[10px] border border-slate-200 bg-slate-50/80 px-2.5 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                    <div>
                      <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Avg / mo
                      </dt>
                      <dd
                        className={`m-0 mt-0.5 text-[0.9rem] font-bold tabular-nums ${toneClass(
                          p.avg_monthly_return_pct ?? p.total_return_pct
                        )}`}
                      >
                        {p.avg_monthly_return_pct == null
                          ? fmtPctSigned(p.total_return_pct, { decimals: 2 })
                          : fmtPctSigned(p.avg_monthly_return_pct, { decimals: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total
                      </dt>
                      <dd
                        className={`m-0 mt-0.5 text-[0.9rem] font-bold tabular-nums ${toneClass(
                          p.total_return_pct
                        )}`}
                      >
                        {fmtPctSigned(p.total_return_pct, { decimals: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Equity
                      </dt>
                      <dd className="m-0 mt-0.5 text-[0.9rem] font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {money(p.equity)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-1.5">
                    <p className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Performance
                    </p>
                    <PublicPortfolioMiniChart
                      history={histories[p.id] || []}
                      loading={historyLoading && !(histories[p.id]?.length > 0)}
                    />
                  </div>
                </div>
                <Link
                  to={href}
                  className="mt-auto inline-flex shrink-0 items-center pt-0.5 text-[0.82rem] font-bold text-blue-700 no-underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  View portfolio
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
