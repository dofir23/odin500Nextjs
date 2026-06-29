'use client';

import TradingChartLoader from './TradingChartLoader.jsx';

const MKT_ASIDE_TITLE_CLASS = 'uppercase text-[12px] font-medium leading-[1.1]';

const LEFT_GROUPS = [
  { id: 'us', title: 'Key US Indices', rows: 3 },
  { id: 'index', title: 'Index ETFs', rows: 3 },
  { id: 'sector', title: 'SP500 Sectors', rows: 11 },
  { id: 'other', title: 'Other Markets ETFs', rows: 5 }
];

const TF_OPTIONS = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'];
const SUMMARY_TF_COUNT = 8;
const SUMMARY_ROWS = 7;
const WATCHLIST_ROWS = 18;

function SkelBlock({ className = '', style }) {
  return <span className={`market-fig-shell-skel__block ${className}`.trim()} style={style} />;
}

function MiniCardHeadSkel({ titleWidth = '58%' }) {
  return (
    <header className="mkt-mini-card__head">
      <span className={MKT_ASIDE_TITLE_CLASS}>
        <SkelBlock style={{ display: 'inline-block', width: titleWidth, height: 12, verticalAlign: 'middle' }} />
        <SkelBlock
          className="market-fig-shell-skel__tf"
          style={{ display: 'inline-block', width: 22, height: 10, marginLeft: 6, verticalAlign: 'middle' }}
        />
      </span>
      <span className="mkt-mini-card__head-actions">
        <SkelBlock style={{ width: 28, height: 18, borderRadius: 4 }} />
        <SkelBlock style={{ width: 36, height: 18, borderRadius: 4 }} />
      </span>
    </header>
  );
}

function MiniCardSubheadSkel() {
  return (
    <div className="mkt-mini-card__subhead" aria-hidden>
      <span>
        <SkelBlock style={{ width: 8, height: 8 }} />
      </span>
      <span>
        <SkelBlock style={{ width: '72%', height: 8 }} />
      </span>
      <span>
        <SkelBlock style={{ width: 18, height: 8 }} />
      </span>
      <span>
        <SkelBlock style={{ width: '100%', height: 8 }} />
      </span>
      <span>
        <SkelBlock style={{ width: '100%', height: 8 }} />
      </span>
      <span>
        <SkelBlock style={{ width: '100%', height: 8 }} />
      </span>
    </div>
  );
}

function MiniCardRowSkel({ delay = 0 }) {
  const delayStr = `${delay}s`;
  return (
    <div className="mkt-mini-card__row market-fig-shell-skel__mini-row" aria-hidden>
      <SkelBlock style={{ width: 12, height: 12, borderRadius: 3, animationDelay: delayStr }} />
      <SkelBlock style={{ width: '88%', maxWidth: '100%', height: 10, animationDelay: `${delay + 0.02}s` }} />
      <SkelBlock style={{ width: '100%', height: 10, animationDelay: `${delay + 0.03}s` }} />
      <SkelBlock style={{ width: '100%', height: 10, animationDelay: `${delay + 0.04}s` }} />
      <SkelBlock style={{ width: '100%', height: 10, animationDelay: `${delay + 0.05}s` }} />
      <SkelBlock style={{ width: '100%', height: 10, animationDelay: `${delay + 0.06}s` }} />
    </div>
  );
}

function LeftRailSkeleton() {
  return (
    <aside className="mkt-left">
      {LEFT_GROUPS.map((group, gi) => (
        <section key={group.id} className="mkt-mini-card">
          <MiniCardHeadSkel titleWidth={group.id === 'sector' ? '64%' : group.id === 'other' ? '78%' : '56%'} />
          <MiniCardSubheadSkel />
          {Array.from({ length: group.rows }, (_, ri) => (
            <MiniCardRowSkel key={ri} delay={gi * 0.04 + ri * 0.03} />
          ))}
        </section>
      ))}
    </aside>
  );
}

function PerformanceChartSkeleton() {
  return (
    <section className="np-card" aria-label="Loading performance chart">
      <header className="np-card__head">
        <h1 className="np-card__title">
          <SkelBlock style={{ width: 148, height: 22 }} />
        </h1>
        <div className="np-card__head-actions">
          <SkelBlock className="market-fig-shell-skel__icon" style={{ width: 30, height: 30 }} />
          <SkelBlock className="market-fig-shell-skel__icon" style={{ width: 30, height: 30 }} />
        </div>
      </header>

      <div className="np-card__tf-row" aria-hidden>
        {TF_OPTIONS.map((id, i) => (
          <SkelBlock
            key={id}
            className={'market-fig-shell-skel__tf-btn' + (id === '6M' ? ' market-fig-shell-skel__tf-btn--active' : '')}
            style={{ width: id === '10Y' ? 30 : 28, height: 26, animationDelay: `${i * 0.025}s` }}
          />
        ))}
      </div>

      <div className="np-card__chips-row" aria-hidden>
        <div className="np-card__chips">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="np-card__chip market-fig-shell-skel__chip">
              <SkelBlock style={{ width: 68 + i * 10, height: 22, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <SkelBlock style={{ width: 52, height: 28, borderRadius: 6, flexShrink: 0 }} />
      </div>

      <div className="np-chart-wrap">
        <div className="chart-viz-loading-wrap" style={{ minHeight: 390 }}>
          <TradingChartLoader label="Loading chart…" sublabel="Normalized performance" />
        </div>
      </div>
    </section>
  );
}

function ReturnsSummarySkeleton() {
  return (
    <section
      className="mkt-watch-card mkt-returns-summary return-table-page__section-card"
      style={{ '--mkt-summary-tf-count': SUMMARY_TF_COUNT }}
      aria-label="Loading index and sector returns"
    >
      <header className="mkt-watch-card__head mkt-returns-summary__head">
        <span className="mkt-returns-summary__title-row">
          <SkelBlock style={{ width: '62%', maxWidth: 220, height: 12 }} />
        </span>
      </header>
      <div className="mkt-returns-summary__scroll">
        <div className="mkt-watch-card__table mkt-returns-summary__table" aria-hidden>
          <div className="mkt-watch-card__row mkt-watch-card__row--head mkt-returns-summary__row">
            <span className="mkt-returns-summary__h">
              <SkelBlock style={{ width: 44, height: 10 }} />
            </span>
            {Array.from({ length: SUMMARY_TF_COUNT }, (_, i) => (
              <span key={i} className="mkt-returns-summary__h mkt-returns-summary__h--num">
                <SkelBlock style={{ width: 22, height: 10, animationDelay: `${i * 0.02}s` }} />
              </span>
            ))}
          </div>
          {Array.from({ length: SUMMARY_ROWS }, (_, r) => (
            <div key={r} className="mkt-watch-card__row mkt-returns-summary__row">
              <span>
                <SkelBlock style={{ width: '78%', height: 10, animationDelay: `${r * 0.03}s` }} />
              </span>
              {Array.from({ length: SUMMARY_TF_COUNT }, (_, c) => (
                <span key={c} className="mkt-returns-summary__cell mkt-returns-summary__cell--num">
                  <SkelBlock style={{ width: 30, height: 10, animationDelay: `${r * 0.03 + c * 0.015}s` }} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeatmapThumbSkeleton() {
  return (
    <section className="mkt-heat-thumb-card mkt-heat-thumb-card--figma" aria-label="Loading heatmap">
      <header className="mkt-heat-thumb-card__head mkt-heat-thumb-card__head--figma">
        <SkelBlock style={{ width: '54%', maxWidth: 200, height: 12 }} />
      </header>
      <div className="mkt-treemap-thumb-host mkt-treemap-thumb-host--figma" aria-busy="true">
        <div className="mkt-treemap-thumb-host__loading" role="status" aria-live="polite">
          <TradingChartLoader label="Loading heatmap…" sublabel="Fetching quotes & constituents" />
        </div>
      </div>
    </section>
  );
}

function WatchlistSkeleton() {
  return (
    <aside className="mkt-right">
      <section className="mkt-watch-card" aria-label="Loading tickers list">
        <header className="mkt-watch-card__head">
          <span className={MKT_ASIDE_TITLE_CLASS}>
            <SkelBlock style={{ width: 88, height: 12 }} />
          </span>
          <div className="mkt-watch-card__controls">
            <SkelBlock style={{ width: '100%', height: 30, borderRadius: 6 }} />
          </div>
        </header>
        <div className="mkt-watch-card__table">
          <div className="mkt-watch-card__row mkt-watch-card__row--head" aria-hidden>
            <SkelBlock style={{ width: 52, height: 10 }} />
            <SkelBlock style={{ width: 28, height: 10 }} />
            <SkelBlock style={{ width: 24, height: 10 }} />
          </div>
          {Array.from({ length: WATCHLIST_ROWS }, (_, i) => (
            <div key={i} className="mkt-watch-card__row market-fig-shell-skel__watch-row" aria-hidden>
              <SkelBlock style={{ width: '72%', height: 10, animationDelay: `${i * 0.025}s` }} />
              <SkelBlock style={{ width: 40, height: 10, animationDelay: `${i * 0.025 + 0.02}s` }} />
              <SkelBlock style={{ width: 32, height: 10, animationDelay: `${i * 0.025 + 0.03}s` }} />
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

/** Loading shell for `/market` — mirrors `MarketPageFigmaShell` grid and card layout. */
export function MarketPageFigmaShellSkeleton() {
  return (
    <section className="mkt-fig-shell route-page-skeleton market-fig-shell-skel" aria-busy="true" aria-label="Loading market dashboard">
      <LeftRailSkeleton />
      <main className="mkt-center">
        <PerformanceChartSkeleton />
        <div className="mkt-center-bottom">
          <ReturnsSummarySkeleton />
          <HeatmapThumbSkeleton />
        </div>
      </main>
      <WatchlistSkeleton />
    </section>
  );
}
