'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { enrichPortfolioTags } from '@/utils/aiPortfolioTags.js';
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

/** Human track-record length for the card's third stat tile — "12 d", "3.4 mo". */
export function trackRecordLabel(p) {
  const days = Number(p?.days_elapsed);
  const months = Number(p?.months_elapsed);
  if (Number.isFinite(days) && days < 30) return `${Math.max(1, Math.round(days))} d`;
  if (Number.isFinite(months) && months >= 1) return `${months.toFixed(1)} mo`;
  return '—';
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
  if (Number.isFinite(daysN) && daysN < 30) {
    const d = Math.max(1, Math.round(daysN));
    bits.push(`tracked for about ${d} day${d === 1 ? '' : 's'}`);
  } else if (months != null && Number(months) >= 1) {
    bits.push(`over ~${months} months`);
  }

  return `${bits.join(' ')}.`;
}

/** Ranked on total return — see SORT_KEYS in the backend's publicPortfolioQuery.js. */
export function pickTopPublicPortfolios(portfolios, limit = 3) {
  return [...(portfolios || [])]
    .sort((a, b) => {
      const av = a.total_return_pct;
      const bv = b.total_return_pct;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return Number(bv) - Number(av);
    })
    .slice(0, limit)
    .map(enrichPortfolioTags);
}

const RANK_LABELS = ['1st', '2nd', '3rd'];

/**
 * No max-height: the card grows to whatever its content needs. A cap here would have to be paid
 * for with an inner scroll area, and a summary card you have to scroll hides the very numbers it
 * exists to show. Cards in a row still line up — `h-full` stretches each to the tallest.
 */
const CARD_BASE =
  'flex h-full min-h-[14rem] flex-col gap-3 rounded-[14px] border px-4 pb-3.5 pt-4 transition duration-150 ease-out hover:-translate-y-0.5';

const CARD_BASE_COMPACT =
  'flex h-full min-h-[11.5rem] flex-col gap-2.5 rounded-[12px] border px-3 pb-3 pt-3 transition duration-150 ease-out hover:-translate-y-0.5';

const CARD_BY_RANK = [
  // 1st
  `border-amber-300/70 bg-gradient-to-br from-amber-50 to-white shadow-sm hover:border-amber-400 hover:shadow-md dark:border-amber-400/35 dark:from-amber-400/10 dark:to-white/[0.02] dark:shadow-none dark:hover:border-amber-400/50 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`,
  // 2nd
  `border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md dark:border-slate-400/35 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-blue-400/40 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`,
  // 3rd
  `border-orange-200/90 bg-gradient-to-br from-orange-50/80 to-white shadow-sm hover:border-orange-300 hover:shadow-md dark:border-orange-500/30 dark:from-orange-500/10 dark:to-white/[0.02] dark:shadow-none dark:hover:border-orange-400/40 dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.28)]`
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

/**
 * Which way the book trades, beside the engine and index chips. Colour carries the meaning at a
 * glance — green long, red short, teal for a hedged long-short — so the three never read as the
 * same kind of tag.
 */
const BADGE_BY_DIRECTION = {
  long: `${BADGE_BASE} border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300`,
  short: `${BADGE_BASE} border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300`,
  long_short: `${BADGE_BASE} border-teal-300/70 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300`
};
const BADGE_DEFAULT = `${BADGE_BASE} border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300`;

const SKEL_CARD =
  'min-h-[11.5rem] pointer-events-none animate-pulse rounded-[14px] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]';

const SKEL_CARD_COMPACT =
  'h-[15.5rem] w-[15.5rem] shrink-0 pointer-events-none animate-pulse rounded-[12px] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] sm:w-[17rem]';

const CAROUSEL_CARD_WIDTH = 'w-[15.5rem] sm:w-[17rem]';

/**
 * @param {{ portfolios: any[], loading: boolean, limit?: number, carousel?: boolean }} props
 * `carousel`: renders a horizontally swipeable/scrollable row of smaller cards (with prev/next
 * buttons) instead of the fixed 3-column grid — used on the AI Portfolios gallery to fit more cards.
 */
export function PublicPortfoliosTopSummary({ portfolios, loading, limit = 3, carousel = false }) {
  const top = useMemo(() => pickTopPublicPortfolios(portfolios, limit), [portfolios, limit]);
  const topIds = useMemo(() => top.map((p) => p.id).join(','), [top]);
  const [histories, setHistories] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiSummaries, setAiSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const scrollerRef = useRef(null);

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

  const scrollByCard = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector('[data-top-card]');
    const step = card ? card.getBoundingClientRect().width + 14 : 260;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  /**
   * Drag-to-scroll across the whole strip, so the gesture works anywhere on it rather than only
   * in the gaps between cards. Snapping is disabled mid-drag so the strip tracks the cursor
   * smoothly, and the click that follows a real drag is swallowed so dragging across a card
   * never navigates to it.
   */
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      dragging: false
    };
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(dx) < 5) return;
      drag.dragging = true;
      el.style.scrollSnapType = 'none';
      el.style.cursor = 'grabbing';
      try {
        el.setPointerCapture(drag.pointerId);
      } catch {
        /* capture is best-effort */
      }
    }
    el.scrollLeft = drag.startScroll - dx;
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    dragRef.current = null;
    if (!drag || !el) return;
    if (drag.dragging) {
      try {
        el.releasePointerCapture(drag.pointerId);
      } catch {
        /* ignore */
      }
      el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, {
        capture: true,
        once: true
      });
    }
    el.style.scrollSnapType = '';
    el.style.cursor = '';
  };

  if (loading) {
    return (
      <section className="mt-5" aria-labelledby="public-top-portfolios-title" aria-busy="true">
        <h2
          id="public-top-portfolios-title"
          className="m-0 text-[1.05rem] font-bold text-slate-900 dark:text-slate-100"
        >
          Top performers
        </h2>
        {carousel ? (
          <div className="mt-3.5 flex gap-3.5 overflow-x-hidden p-0">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className={SKEL_CARD_COMPACT} />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 grid list-none grid-cols-1 gap-3.5 p-0 lg:grid-cols-3">
            {Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
              <div key={i} className={SKEL_CARD} />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (!top.length) return null;

  const renderCard = (p, index) => {
    const href = `/virtual-portfolio/public/${encodeURIComponent(p.id)}`;
    const rank = RANK_LABELS[index] || `${index + 1}th`;
    const summary = aiSummaries[p.id] || (!summaryLoading ? buildPortfolioSummary(p) : '');
    const rankClass = RANK_PILL[index] || RANK_PILL[1];
    const cardClass = `${carousel ? CARD_BASE_COMPACT : CARD_BASE} ${CARD_BY_RANK[index] || CARD_BY_RANK[1]}`;

    return (
      <article className={cardClass}>
        {/* `flex-1` only to push the View link to the bottom of a stretched card — this body
            lays its content out in full, it does not scroll. */}
        <div className="flex flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2.5">
            <span
              className={`inline-flex min-w-[2.35rem] items-center justify-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide ${rankClass}`}
              aria-label={`Rank ${index + 1}`}
            >
              {rank}
            </span>
            <span
              className={
                'inline-flex shrink-0 items-center justify-center rounded-full border border-blue-300/70 bg-blue-50 font-bold tracking-wide text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200' +
                (carousel ? ' h-8 w-8 text-[0.66rem]' : ' h-[2.35rem] w-[2.35rem] text-[0.74rem]')
              }
              aria-hidden
            >
              {ownerInitials(p.owner_label)}
            </span>
          </div>
          <div className="min-w-0">
            <p
              className={
                'm-0 truncate font-bold leading-snug text-slate-900 dark:text-slate-100' +
                (carousel ? ' text-[0.86rem]' : ' text-base')
              }
            >
              {p.name}
            </p>
            <p
              className={
                'mt-0.5 m-0 truncate text-slate-500 dark:text-slate-400' +
                (carousel ? ' text-[0.72rem]' : ' text-sm')
              }
            >
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
              <p
                className={
                  'mt-1.5 m-0 leading-snug text-slate-600 dark:text-slate-400' +
                  (carousel ? ' line-clamp-2 text-[0.72rem]' : ' text-[0.8rem]')
                }
              >
                {summary}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-1.5 empty:hidden">
              {p.ai_engine ? (
                <span className={BADGE_BY_ENGINE[p.ai_engine.id] || BADGE_DEFAULT}>
                  {p.ai_engine.label}
                </span>
              ) : null}
              {p.index_focus ? <span className={BADGE_INDEX}>{p.index_focus.label}</span> : null}
              {/* Only where direction is real: an AI-managed book carries it as a column, and a
                  tagged one names it in its strategy. On an untagged manual portfolio the
                  heuristic's "long" default would be a guess dressed up as a fact. */}
              {p.direction && (p.ai_managed || p.ai_engine) ? (
                <span className={BADGE_BY_DIRECTION[p.direction.id] || BADGE_DEFAULT}>
                  {p.direction.label}
                </span>
              ) : null}
              {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                <span className={BADGE_DEFAULT}>Automated</span>
              ) : null}
            </div>
          </div>
          {/* Four tiles: two rows of two in the narrow carousel card, one row on the wide grid
              card — at 15.5rem a four-across row leaves no room for a six-figure equity. */}
          <dl
            className={
              'm-0 grid gap-2 rounded-[10px] border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.04]' +
              (carousel ? ' grid-cols-2 px-2 py-2' : ' grid-cols-2 px-2.5 py-2.5 sm:grid-cols-4')
            }
          >
            <div>
              <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total
              </dt>
              <dd
                className={`m-0 mt-0.5 font-bold tabular-nums ${carousel ? 'text-[0.8rem]' : 'text-[0.9rem]'} ${toneClass(
                  p.total_return_pct
                )}`}
              >
                {fmtPctSigned(p.total_return_pct, { decimals: 2 })}
              </dd>
            </div>
            {/* Total return favours whichever book has run longest; the monthly average is the
                length-adjusted read, so the two sit side by side. Null until a book is a month
                old — an annualised figure off nine days is noise. */}
            <div>
              <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Monthly avg
              </dt>
              <dd
                className={`m-0 mt-0.5 font-bold tabular-nums ${carousel ? 'text-[0.8rem]' : 'text-[0.9rem]'} ${
                  p.avg_monthly_return_pct == null
                    ? 'text-slate-400 dark:text-slate-500'
                    : toneClass(p.avg_monthly_return_pct)
                }`}
                title={
                  p.avg_monthly_return_pct == null
                    ? 'Needs a full month of track record before an average is meaningful'
                    : undefined
                }
              >
                {p.avg_monthly_return_pct == null
                  ? 'N/A'
                  : fmtPctSigned(p.avg_monthly_return_pct, { decimals: 2 })}
              </dd>
            </div>
            <div>
              <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Equity
              </dt>
              <dd
                className={`m-0 mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100 ${carousel ? 'text-[0.8rem]' : 'text-[0.9rem]'}`}
              >
                {money(p.equity)}
              </dd>
            </div>
            <div>
              <dt className="m-0 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Running
              </dt>
              <dd
                className={`m-0 mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100 ${carousel ? 'text-[0.8rem]' : 'text-[0.9rem]'}`}
              >
                {trackRecordLabel(p)}
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
              height={carousel ? 64 : 86}
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
    );
  };

  return (
    <section className="mt-5" aria-labelledby="public-top-portfolios-title">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="public-top-portfolios-title"
            className="m-0 text-[1.05rem] font-bold text-slate-900 dark:text-slate-100"
          >
            Top performers
          </h2>
          <p className="mt-1.5 m-0 text-[0.86rem] leading-snug text-slate-500 dark:text-slate-400">
            Highest total return among published virtual portfolios.
          </p>
        </div>
        {carousel && top.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <button
              type="button"
              className="paper-btn paper-btn--icon paper-btn--ghost"
              aria-label="Scroll to previous portfolios"
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeft className="paper-btn__icon" aria-hidden />
            </button>
            <button
              type="button"
              className="paper-btn paper-btn--icon paper-btn--ghost"
              aria-label="Scroll to next portfolios"
              onClick={() => scrollByCard(1)}
            >
              <ChevronRight className="paper-btn__icon" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
      {carousel ? (
        <ul
          ref={scrollerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex cursor-grab touch-pan-x list-none gap-3.5 overflow-x-auto p-0 pb-2 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {top.map((p, index) => (
            <li
              key={p.id}
              data-top-card
              className={`mt-2 shrink-0 [scroll-snap-align:start] ${CAROUSEL_CARD_WIDTH}`}
            >
              {renderCard(p, index)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 lg:grid-cols-3">
          {top.map((p, index) => (
            <li key={p.id}>{renderCard(p, index)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
