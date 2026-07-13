'use client';

import { useLocation } from '@/navigation/appRouterCompat.jsx';
import {
  AnnualReturnsFigmaChartSkeleton,
  MarketMoversSplitBarsSkeleton,
  MonthlyReturnsChartSkeleton
} from './ChartSkeletons.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import { MarketPageFigmaShellSkeleton } from './MarketPageFigmaShellSkeleton.jsx';

function SkelPill({ className = '', style }) {
  return <span className={`ticker-annual-figma__skel-pill ${className}`.trim()} style={style} />;
}

function TickerHeaderSkeleton() {
  return (
    <header className="ticker-page__header ticker-page__header--figma route-page-skeleton__header">
      <div className="ticker-page__header-top">
        <div className="ticker-page__header-identity">
          <SkelPill className="ticker-annual-figma__skel-pill--btn-wide" style={{ height: 28, width: '42%', maxWidth: 360 }} />
          <SkelPill className="ticker-annual-figma__skel-pill--sm" style={{ marginTop: 8, width: 120 }} />
        </div>
        <SkelPill className="ticker-annual-figma__skel-pill--btn" style={{ width: 148 }} />
      </div>
      <div className="ticker-page__header-metrics ticker-page__header-metrics--ticker-head">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ticker-page__header-metric">
            <SkelPill style={{ width: '72%', marginBottom: 8, animationDelay: `${i * 0.06}s` }} />
            <SkelPill className="ticker-annual-figma__skel-pill--sm" style={{ width: '54%', animationDelay: `${i * 0.06 + 0.03}s` }} />
          </div>
        ))}
      </div>
    </header>
  );
}

function TickerLikePageSkeleton() {
  return (
    <div className="ticker-page route-page-skeleton" aria-busy="true" aria-label="Loading page">
      <TickerHeaderSkeleton />
      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <div className="ticker-page__stack-column">
            <section className="ticker-card ticker-card--main-chart">
              <div className="ticker-card__head">
                <SkelPill className="ticker-annual-figma__skel-pill--dd" style={{ width: 160 }} />
              </div>
              <TradingChartLoader label="Loading chart…" minHeight={360} />
            </section>
            <AnnualReturnsFigmaChartSkeleton periodMode="annual" plotHeightPx={260} enableInlineYearDropdowns />
            <AnnualReturnsFigmaChartSkeleton periodMode="quarterly" plotHeightPx={260} enableInlineYearDropdowns />
            <MonthlyReturnsChartSkeleton periodMode="monthly" plotHeightPx={278} resizeEnabled />
          </div>
        </div>
        <aside className="ticker-page__aside">
          <section className="mkt-mini-card">
            <SkelPill style={{ width: '60%', marginBottom: 12 }} />
            {[0, 1, 2, 3].map((i) => (
              <SkelPill key={i} style={{ width: '100%', marginBottom: 8, animationDelay: `${i * 0.05}s` }} />
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

function MarketPageSkeleton() {
  return <MarketPageFigmaShellSkeleton />;
}

function HeatmapPageLoader() {
  return (
    <div className="market-heatmap-page route-page-skeleton" aria-busy="true" aria-label="Loading heatmap">
      <TradingChartLoader label="Loading heatmap…" sublabel="Market treemap" minHeight={420} />
    </div>
  );
}

function MarketMoversPageSkeleton() {
  return (
    <div className="market-movers-page route-page-skeleton" aria-busy="true" aria-label="Loading market movers">
      <div className="route-page-skeleton__toolbar">
        <SkelPill className="ticker-annual-figma__skel-pill--btn-wide" />
        <SkelPill className="ticker-annual-figma__skel-pill--dd" />
      </div>
      <MarketMoversSplitBarsSkeleton />
      <div className="route-page-skeleton__movers-tables">
        <TableRowsSkeleton rows={10} cols={4} />
        <TableRowsSkeleton rows={10} cols={4} />
      </div>
    </div>
  );
}

function TableRowsSkeleton({ rows = 12, cols = 4 }) {
  return (
    <div className="route-page-skeleton__table" aria-hidden>
      <div
        className="route-page-skeleton__table-head"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }, (_, i) => (
          <SkelPill key={i} className="ticker-annual-figma__skel-pill--legend" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="route-page-skeleton__table-row"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <span
              key={c}
              className="historical-data__skel-cell"
              style={{ maxWidth: c === 0 ? '88%' : '72%', animationDelay: `${r * 0.03 + c * 0.02}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TablePageSkeleton() {
  return (
    <div className="route-page-skeleton route-page-skeleton--table-page" aria-busy="true" aria-label="Loading table">
      <div className="route-page-skeleton__toolbar">
        <SkelPill className="ticker-annual-figma__skel-pill--btn-wide" />
        <SkelPill className="ticker-annual-figma__skel-pill--dd" />
        <SkelPill className="ticker-annual-figma__skel-pill--btn" />
      </div>
      <TableRowsSkeleton rows={16} cols={6} />
    </div>
  );
}

function PeriodicReturnsPageSkeleton() {
  return (
    <div className="ticker-page route-page-skeleton" aria-busy="true" aria-label="Loading returns">
      <TickerHeaderSkeleton />
      <AnnualReturnsFigmaChartSkeleton periodMode="annual" plotHeightPx={320} enableInlineYearDropdowns showOpenPeriodPageButton />
      <TableRowsSkeleton rows={8} cols={5} />
    </div>
  );
}

function NewsPageSkeleton() {
  return (
    <div className="route-page-skeleton route-page-skeleton--news" aria-busy="true" aria-label="Loading news">
      <SkelPill className="ticker-annual-figma__skel-pill--btn-wide" style={{ marginBottom: 16 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="route-page-skeleton__news-row">
          <SkelPill style={{ width: '18%', animationDelay: `${i * 0.05}s` }} />
          <SkelPill style={{ flex: 1, animationDelay: `${i * 0.05 + 0.02}s` }} />
        </div>
      ))}
    </div>
  );
}

function RelativeStrengthPageSkeleton() {
  return (
    <div className="relative-strength-page route-page-skeleton" aria-busy="true" aria-label="Loading relative strength">
      <TickerHeaderSkeleton />
      <div className="route-page-skeleton__toolbar">
        <SkelPill className="ticker-annual-figma__skel-pill--dd" />
        <SkelPill className="ticker-annual-figma__skel-pill--dd" />
      </div>
      <TradingChartLoader label="Loading chart…" minHeight={420} className="relative-strength-page__chart-skel-fill" />
      <TableRowsSkeleton rows={6} cols={4} />
    </div>
  );
}

function GenericPageSkeleton() {
  return (
    <div className="route-page-skeleton route-page-skeleton--generic" aria-busy="true" aria-label="Loading page">
      <SkelPill className="ticker-annual-figma__skel-pill--btn-wide" style={{ marginBottom: 20 }} />
      <SkelPill style={{ width: '72%', marginBottom: 12 }} />
      <SkelPill style={{ width: '54%', marginBottom: 24 }} />
    </div>
  );
}

export function resolveRouteSkeletonKind(pathname) {
  const p = String(pathname || '/').split('?')[0].split('#')[0] || '/';
  if (p === '/ticker' || /^\/ticker\/[^/]+/.test(p)) return 'ticker';
  if (p === '/indices' || /^\/indices\/[^/]+/.test(p)) return 'ticker';
  if (p === '/sector-data' || /^\/sector-data\/[^/]+/.test(p)) return 'ticker';
  if (p === '/ticker-report' || /^\/ticker-report\/[^/]+/.test(p)) return 'ticker';
  if (p === '/market') return 'market';
  if (p === '/market-movers') return 'market-movers';
  if (p === '/heatmap' || p === '/odin-signals') return 'heatmap';
  if (p === '/historical-data' || /^\/historical-data\/[^/]+/.test(p)) return 'table';
  if (p === '/statistic-data' || p === '/return-table' || p === '/stock-splits') return 'table';
  if (/^\/statistic\/ticker-/.test(p)) return 'periodic';
  if (p === '/news') return 'news';
  if (p === '/relative-performance' || /^\/relative-performance\//.test(p)) return 'relative-strength';
  return 'generic';
}

/**
 * @param {{ pathname?: string }} [props]
 */
export function RoutePageSkeleton({ pathname: pathnameProp } = {}) {
  const { pathname: pathnameFromHook } = useLocation();
  const pathname = pathnameProp ?? pathnameFromHook ?? '/';
  const kind = resolveRouteSkeletonKind(pathname);

  switch (kind) {
    case 'ticker':
      return <TickerLikePageSkeleton />;
    case 'market':
      return <MarketPageSkeleton />;
    case 'market-movers':
      return <MarketMoversPageSkeleton />;
    case 'heatmap':
      return <HeatmapPageLoader />;
    case 'table':
      return <TablePageSkeleton />;
    case 'periodic':
      return <PeriodicReturnsPageSkeleton />;
    case 'news':
      return <NewsPageSkeleton />;
    case 'relative-strength':
      return <RelativeStrengthPageSkeleton />;
    default:
      return <GenericPageSkeleton />;
  }
}
