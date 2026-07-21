'use client';

import { useEffect, useState } from 'react';
import { HOME_AI_PORTFOLIOS } from '@/content/homePageContent';
import { apiUrl } from '@/utils/apiOrigin.js';
import { pickHomeAiPortfolioTeaser } from '@/utils/aiPortfolioTags.js';
import { fmtPctSigned } from '@/utils/formatDisplayNumber.js';

type AiTag = { id: string; label: string } | null;

type HomeAiPortfolioRow = {
  id: string;
  name: string;
  equity?: number | null;
  total_return_pct?: number | null;
  positions_count?: number | null;
  ai_engine?: AiTag;
  index_focus?: AiTag;
};

type LiveState = {
  loading: boolean;
  error: string;
  rows: HomeAiPortfolioRow[];
  source: 'ai' | 'public-fallback';
};

function money(v: unknown) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(v));
}

function toneClass(v: unknown) {
  if (Number(v) > 0) return 'home-ai-live__tone--up';
  if (Number(v) < 0) return 'home-ai-live__tone--down';
  return '';
}

export function HomeAiPortfoliosLive() {
  const [state, setState] = useState<LiveState>({
    loading: true,
    error: '',
    rows: [],
    source: 'ai'
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/public/paper/portfolios'));
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load portfolios');
        const { rows, source } = pickHomeAiPortfolioTeaser(payload.portfolios || [], 6);
        if (!cancelled) {
          setState({
            loading: false,
            error: '',
            rows: rows as HomeAiPortfolioRow[],
            source: source as LiveState['source']
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load portfolios',
            rows: [],
            source: 'ai'
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { liveTitle, liveEmpty } = HOME_AI_PORTFOLIOS;

  return (
    <div className="home-ai-live">
      <div className="home-ai-live__head">
        <h3 className="home-ai-live__title">{liveTitle}</h3>
        {state.source === 'public-fallback' && state.rows.length ? (
          <p className="home-ai-live__note">
            Showing top published virtual portfolios while AI-tagged books come online.
          </p>
        ) : null}
      </div>

      {state.loading ? (
        <div className="home-ai-live__grid" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="home-ai-live__card home-ai-live__card--skel" />
          ))}
        </div>
      ) : null}

      {!state.loading && state.error ? (
        <p className="home-ai-live__empty">{liveEmpty}</p>
      ) : null}

      {!state.loading && !state.error && !state.rows.length ? (
        <p className="home-ai-live__empty">{liveEmpty}</p>
      ) : null}

      {!state.loading && state.rows.length > 0 ? (
        <ul className="home-ai-live__grid">
          {state.rows.map((p) => {
            const href = `/paper-trading/public/${encodeURIComponent(p.id)}`;
            return (
              <li key={p.id}>
                <a href={href} className="home-ai-live__card">
                  <div className="home-ai-live__card-top">
                    <span className="home-ai-live__name">{p.name}</span>
                    <span className="home-ai-live__badges">
                      {p.ai_engine ? (
                        <span className={`home-ai-live__badge home-ai-live__badge--${p.ai_engine.id}`}>
                          {p.ai_engine.label}
                        </span>
                      ) : null}
                      {p.index_focus ? (
                        <span className="home-ai-live__badge home-ai-live__badge--index">
                          {p.index_focus.label}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="home-ai-live__metrics">
                    <div>
                      <span className="home-ai-live__metric-label">Equity</span>
                      <span className="home-ai-live__metric-value">{money(p.equity)}</span>
                    </div>
                    <div>
                      <span className="home-ai-live__metric-label">Return</span>
                      <span
                        className={
                          'home-ai-live__metric-value ' + toneClass(p.total_return_pct)
                        }
                      >
                        {fmtPctSigned(p.total_return_pct, { decimals: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="home-ai-live__metric-label">Positions</span>
                      <span className="home-ai-live__metric-value">{p.positions_count ?? 0}</span>
                    </div>
                  </div>
                  <span className="home-ai-live__cta">View performance</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
