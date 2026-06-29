'use client';
import { useSyncExternalStore } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { Odin500BrandLink } from '../Odin500BrandLink.jsx';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { TickerReportAnnualCompareChart, TickerReportMonthlyReturnsChart } from './TickerReportCharts.jsx';
import { TickerReportDrawdownChart } from './TickerReportDrawdownChart.jsx';
import { TickerReportPriceChart } from './TickerReportPriceChart.jsx';
import { TickerReportRelativeStrengthChart } from './TickerReportRelativeStrengthChart.jsx';
import { SeasonalityHeatmap } from './SeasonalityHeatmap.jsx';
import { valueToneClassName } from '../../utils/tickerReportValueTone.js';

function MetricTable({ rows, columns, compact = false, compactMobile = false }) {
  const wrapClass =
    'ticker-report__table-wrap' +
    (compact ? ' ticker-report__table-wrap--fit' : '') +
    (compactMobile ? ' ticker-report__table-wrap--fit-mobile' : '');
  const tableClass =
    'ticker-report__table' +
    (compact ? ' ticker-report__table--compact' : '') +
    (compactMobile ? ' ticker-report__table--compact-mobile' : '');

  return (
    <div className={wrapClass}>
    <table className={tableClass}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} className={col !== columns[0] ? 'ticker-report__th-num' : undefined}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.period || row.label || row.quarter || row.year || row.rank}>
            <td className={row.bold ? 'ticker-report__label-bold' : 'ticker-report__label'}>
              {row.period || row.label || row.quarter || row.year || `#${row.rank} ${row.label}`}
            </td>
            {row.ticker != null ? (
              <>
                <td className={`ticker-report__th-num ${valueToneClassName(row.tickerTone, row.ticker)}`}>
                  {row.ticker}
                </td>
                <td className={`ticker-report__th-num ${valueToneClassName(row.benchTone, row.bench)}`}>
                  {row.bench}
                </td>
                <td className={`ticker-report__th-num ${valueToneClassName(row.excessTone, row.excess)}`}>
                  {row.excess}
                </td>
              </>
            ) : (
              <td
                className={`ticker-report__th-num ${valueToneClassName(row.tone, row.value)}`}
                colSpan={columns.length - 1}
              >
                {row.value}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function SectionIntro({ children }) {
  if (!children) return null;
  return <p className="ticker-report__narrative">{children}</p>;
}

function SectionSummary({ paragraphs }) {
  if (!paragraphs?.length) return null;
  return (
    <div className="ticker-report__summaries">
      {paragraphs.map((p) => (
        <p key={p.slice(0, 48)} className="ticker-report__summary">
          {p}
        </p>
      ))}
    </div>
  );
}

export function TickerReportContent({ report }) {
  const m = report.meta;
  const sym = m.symbol;
  const isAnnual = m.reportKind === 'annual';
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const n = report.sectionNarratives || {};
  const monthlyObs =
    report.monthlyStatsObservationCount ?? report.monthlyStatsRight?.find((r) => r.label === 'Total Months')?.value ?? 39;

  return (
    <article className="ticker-report__article">
      <header className="ticker-report__header">
        <Odin500BrandLink imgClassName="ticker-report__logo" theme={theme} />
        <div className="ticker-report__header-meta">
          {isAnnual ? 'Annual Stock Report' : 'Monthly Stock Report'}
          <br />
          Published {m.publishedLabel}
        </div>
      </header>

      <h1 className="ticker-report__title">
        {m.companyName} ({sym}) {isAnnual ? 'Annual' : 'Monthly'} Performance Report — {m.periodLabel}
      </h1>
      <p className="ticker-report__subtitle">
        Trailing returns, drawdown, relative strength and statistical review of {sym} stock
        {isAnnual ? ` for calendar year ${m.year}.` : ` for ${m.periodLabel}.`}
      </p>
      <p className="ticker-report__byline">
        <strong>{sym}</strong> · {m.exchange} · {m.sector} · {m.industry} · Member: {m.indices.join(', ')} ·
        Benchmark: {m.benchmark}
      </p>

      <aside className="ticker-report__takeaways">
        <h2>Key Takeaways</h2>
        <ul>
          {report.takeaways.map((t) => (
            <li key={t.slice(0, 48)}>{t}</li>
          ))}
        </ul>
      </aside>

      <div className="ticker-report__stats-grid">
        {report.statsGrid.map((card) => (
          <div key={card.label} className="ticker-report__stat-card">
            <p className="ticker-report__stat-k">{card.label}</p>
            <p className={`ticker-report__stat-v ${valueToneClassName(card.tone, card.value)}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <h2>
        <span className="ticker-report__section-num">01</span>
        {isAnnual ? `${m.year} in Review` : `${m.monthLabel} ${m.year} in Review`}
      </h2>
      {report.recapParagraphs.map((p) => (
        <p key={p.slice(0, 40)}>{p}</p>
      ))}

      <TickerReportPriceChart
        symbol={sym}
        periodEnd={m.periodEnd}
        fallback={report.charts.price3y}
        chartCaption={n.priceChartCaption}
      />

      <h2>
        <span className="ticker-report__section-num">02</span>
        Trailing Returns
      </h2>
      <SectionIntro>
        {n.trailingReturns?.intro ||
          `The table below summarizes ${sym}'s price performance across standard time horizons, alongside the S&P 500 (SPY) benchmark and the implied excess return.`}
      </SectionIntro>
      <MetricTable
        rows={report.trailingReturns}
        columns={['Period', sym, 'S&P 500 (SPY)', 'Excess Return']}
      />
      <SectionSummary paragraphs={n.trailingReturns?.summary ? [n.trailingReturns.summary] : []} />

      <h2>
        <span className="ticker-report__section-num">03</span>
        Monthly Return Statistics (Last 3 Years)
      </h2>
      <SectionIntro>
        {n.monthlyStats?.intro ? (
          n.monthlyStats.intro
        ) : (
          <>
            Statistics derived from <strong>{monthlyObs} monthly observations</strong> covering the trailing three
            years.
          </>
        )}
      </SectionIntro>
      <div className="ticker-report__split-cols ticker-report__split-cols--monthly-stats">
        <MetricTable rows={report.monthlyStatsLeft} columns={['Statistic', 'Value']} compact />
        <MetricTable rows={report.monthlyStatsRight} columns={['Win Rate', 'Count']} compact />
      </div>

      <TickerReportMonthlyReturnsChart data={report.charts.monthlyReturns} />
      <SectionSummary paragraphs={n.monthlyStats?.summary ? [n.monthlyStats.summary] : []} />

      <h2>
        <span className="ticker-report__section-num">04</span>
        Best and Worst Months
      </h2>
      <div className="ticker-report__split-cols">
        <table className="ticker-report__table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Best Month</th>
              <th className="ticker-report__th-num">Return</th>
            </tr>
          </thead>
          <tbody>
            {report.bestMonths.map((row) => (
              <tr key={row.rank}>
                <td className="ticker-report__label-bold">#{row.rank}</td>
                <td className="ticker-report__label">{row.label}</td>
                <td className={`ticker-report__th-num ${valueToneClassName('pos', row.value)}`}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="ticker-report__table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Worst Month</th>
              <th className="ticker-report__th-num">Return</th>
            </tr>
          </thead>
          <tbody>
            {report.worstMonths.map((row) => (
              <tr key={row.rank}>
                <td className="ticker-report__label-bold">#{row.rank}</td>
                <td className="ticker-report__label">{row.label}</td>
                <td className={`ticker-report__th-num ${valueToneClassName('neg', row.value)}`}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionSummary paragraphs={n.bestWorstMonths?.summary ? [n.bestWorstMonths.summary] : []} />

      <h2>
        <span className="ticker-report__section-num">05</span>
        Quarterly and Annual Performance
      </h2>
      <h3>Last Six Quarters</h3>
      <MetricTable rows={report.quarters} columns={['Quarter', 'Return']} compactMobile />
      <h3>Calendar Year Returns</h3>
      <MetricTable rows={report.calendarYears} columns={['Year', 'Return']} compactMobile />

      <SectionSummary paragraphs={n.quarterlyAnnual?.summary ? [n.quarterlyAnnual.summary] : []} />
      <TickerReportAnnualCompareChart data={report.charts.annualCompare} symbol={sym} />

      <h2>
        <span className="ticker-report__section-num">06</span>
        Drawdown Technical Position
      </h2>
      <SectionIntro>{n.drawdown?.intro}</SectionIntro>
      <MetricTable rows={report.drawdownMetrics} columns={['Metric', 'Value']} compactMobile />
      <SectionSummary paragraphs={n.drawdown?.summary ? [n.drawdown.summary] : []} />
      <TickerReportDrawdownChart data={report.charts.drawdown} symbol={sym} periodEnd={m.periodEnd} />

      <h2>
        <span className="ticker-report__section-num">07</span>
        Relative Strength vs S&amp;P 500
      </h2>
      <SectionIntro>{n.relativeStrength?.intro}</SectionIntro>
      <MetricTable rows={report.relativeStrength} columns={['RS Metric', 'Value']} compactMobile />
      <SectionSummary
        paragraphs={[n.relativeStrength?.summary, n.relativeStrength?.summaryExtra].filter(Boolean)}
      />
      <TickerReportRelativeStrengthChart
        data={report.charts.relativeStrength}
        symbol={sym}
        periodEnd={m.periodEnd}
        benchmark="SPY"
      />

      <h2>
        <span className="ticker-report__section-num">08</span>
        Monthly Seasonality
      </h2>
      <SectionIntro>{n.seasonality?.intro}</SectionIntro>
      <SeasonalityHeatmap seasonality={report.seasonality} />
      <SectionSummary paragraphs={n.seasonality?.summary ? [n.seasonality.summary] : []} />

      {/* <h2>
        <span className="ticker-report__section-num">09</span>
        Investment Attractiveness Scorecard
      </h2>
      <SectionIntro>{n.scorecard?.intro}</SectionIntro>
      <div className="ticker-report__scorecard">
        <div className="ticker-report__score-row">
          <span className="ticker-report__score-lbl">Overall Rank</span>
          <span className="ticker-report__score-bar-wrap">
            <span className="ticker-report__score-bar" style={{ width: `${report.scorecard.overallPct}%` }} />
          </span>
          <span className="ticker-report__score-val">{report.scorecard.rank}</span>
        </div>
        <div className="ticker-report__score-row">
          <span className="ticker-report__score-lbl">Total Score</span>
          <span className="ticker-report__score-bar-wrap">
            <span className="ticker-report__score-bar" style={{ width: `${report.scorecard.totalPct}%` }} />
          </span>
          <span className="ticker-report__score-val">{report.scorecard.total}</span>
        </div>
        <div className="ticker-report__score-row">
          <span className="ticker-report__score-lbl">Tier</span>
          <span className="ticker-report__score-val ticker-report__score-tier">{report.scorecard.tier}</span>
        </div>
      </div>
      <div className="ticker-report__scorecard">
        {report.scorecard.pillars.map((p) => (
          <div key={p.label} className="ticker-report__score-row">
            <span className="ticker-report__score-lbl">{p.label}</span>
            <span className="ticker-report__score-bar-wrap">
              <span className="ticker-report__score-bar" style={{ width: `${p.pct}%` }} />
            </span>
            <span className="ticker-report__score-val">{p.score}</span>
          </div>
        ))}
      </div>
      <SectionSummary paragraphs={n.scorecard?.summary ? [n.scorecard.summary] : []} /> */}

      <h2>
        <span className="ticker-report__section-num">09</span>
        Frequently Asked Questions
      </h2>
      {report.faqs.map((item) => (
        <div key={item.q} className="ticker-report__faq">
          <h3 className="ticker-report__faq-q">{item.q}</h3>
          <p className="ticker-report__faq-a">{item.a}</p>
        </div>
      ))}

      <section className="ticker-report__related" aria-label="Related pages">
        <h2>
          <span className="ticker-report__section-num">10</span>
          Related on Odin500
        </h2>
        <ul>
          <li>
            <Link to={`/ticker/${encodeURIComponent(sym.toLowerCase())}`}>{sym} ticker page</Link> — live charts and
            statistics.
          </li>
          <li>
            <Link to={`/historical-data/${encodeURIComponent(sym.toLowerCase())}`}>Historical OHLC data</Link> —
            export price history.
          </li>
          <li>
            <Link to="/indices/sp500">S&amp;P 500 index</Link> — benchmark context.
          </li>
        </ul>
      </section>

      <aside className="ticker-report__disclosure">
        <p>
          <strong>Disclosure.</strong> This report is generated by Odin500&apos;s automated stock analytics platform
          and is for informational purposes only. Nothing herein constitutes investment advice. Past performance does
          not guarantee future results.
        </p>
        <p>
          <strong>Report metadata.</strong> Ticker: {sym} · Period: {m.periodLabel} · Benchmark: {m.benchmark} · Data
          window: {m.dataWindow}.
        </p>
      </aside>

      <footer className="ticker-report__footer">
        <p>© {m.year} Odin500. Visit odin500.com for daily market analytics.</p>
      </footer>
    </article>
  );
}
