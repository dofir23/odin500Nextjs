/** Server-rendered page body — tables, SVG charts, and summaries for SSR + enhance. */

import type { ReactNode } from 'react';
import { SvgBarChart } from '@/seo/charts/SvgBarChart';
import { SvgSparkline } from '@/seo/charts/SvgSparkline';
import { STATIC_PAGE_SEO } from '@/seo/staticPageSeoCopy';

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
}

function cell(v: unknown) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v * 100) / 100);
  return String(v);
}

function SimpleTable({
  caption,
  columns,
  rows
}: {
  caption: string;
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, unknown>[];
}) {
  if (!rows.length) return null;
  const limited = rows.slice(0, 120);
  return (
    <table className="seo-server-table w-full border-collapse text-left text-sm">
      <caption className="mb-2 text-base font-semibold">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className="border border-slate-300 px-2 py-1 font-semibold">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {limited.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key} className="border border-slate-300 px-2 py-1">
                {cell(row[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function returnsBarPoints(rows: unknown[]) {
  return asRows(rows)
    .map((r) => ({
      label: String(r.period ?? r.year ?? r.label ?? r.date ?? '').slice(0, 12),
      value: Number(r.totalReturn ?? r.return_pct ?? r.return)
    }))
    .filter((p) => p.label && Number.isFinite(p.value));
}

function ReturnsSeriesBlock({
  rows,
  caption
}: {
  rows: unknown[] | undefined;
  caption: string;
}) {
  if (!rows?.length) return null;
  const points = returnsBarPoints(rows);
  return (
    <>
      <SvgBarChart caption={`${caption} (chart)`} points={points} />
      <SimpleTable
        caption={caption}
        columns={[
          { key: 'period', label: 'Period' },
          { key: 'return_pct', label: 'Return %' }
        ]}
        rows={asRows(rows).map((r) => ({
          period: r.period ?? r.year ?? r.label ?? r.date,
          return_pct: r.totalReturn ?? r.return_pct ?? r.return
        }))}
      />
    </>
  );
}

function ReturnsValsTable({ vals }: { vals: Record<string, Record<string, number | undefined>> }) {
  const tickers = Object.keys(vals || {}).slice(0, 80);
  if (!tickers.length) return null;
  const horizons = new Set<string>();
  for (const t of tickers) {
    Object.keys(vals[t] || {}).forEach((h) => horizons.add(h));
  }
  const cols = Array.from(horizons).slice(0, 12);
  const rows = tickers.map((ticker) => {
    const row: Record<string, unknown> = { ticker };
    for (const h of cols) row[h] = vals[ticker]?.[h];
    return row;
  });
  return (
    <SimpleTable
      caption="Period returns (%)"
      columns={[{ key: 'ticker', label: 'Ticker' }, ...cols.map((h) => ({ key: h, label: h }))]}
      rows={rows}
    />
  );
}

function TickerDetailsTable({ rows, caption }: { rows: unknown[]; caption: string }) {
  const list = asRows(rows);
  if (!list.length) return null;
  const columns = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'name', label: 'Name' },
    { key: 'sector', label: 'Sector' },
    { key: 'signal', label: 'Signal' },
    { key: 'return_pct', label: 'Return %' },
    { key: 'market_cap', label: 'Market cap' }
  ];
  const normalized = list.map((r) => ({
    symbol: r.symbol ?? r.ticker ?? r.Symbol,
    name: r.name ?? r.company_name ?? r.companyName,
    sector: r.sector ?? r.industry,
    signal: r.signal ?? r.odin_signal ?? r.odinsignal ?? r.signal_bucket,
    return_pct: r.return_pct ?? r.returnPct ?? r.change_pct ?? r.changePercent,
    market_cap: r.market_cap ?? r.marketCap
  }));
  return <SimpleTable caption={caption} columns={columns} rows={normalized} />;
}

function OhlcTable({ rows, caption }: { rows: unknown[]; caption: string }) {
  const list = asRows(rows);
  if (!list.length) return null;
  return (
    <>
      <SvgSparkline rows={list} caption={`${caption} — price trend`} />
      <SimpleTable
        caption={caption}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'open', label: 'Open' },
          { key: 'high', label: 'High' },
          { key: 'low', label: 'Low' },
          { key: 'close', label: 'Close' },
          { key: 'volume', label: 'Volume' }
        ]}
        rows={list.map((r) => ({
          date: r.date ?? r.trade_date ?? r.time,
          open: r.open ?? r.o ?? r.Open,
          high: r.high ?? r.h ?? r.High,
          low: r.low ?? r.l ?? r.Low,
          close: r.close ?? r.c ?? r.Close ?? r.adj_close,
          volume: r.volume ?? r.v ?? r.Volume
        }))}
      />
    </>
  );
}

function NewsList({ items, caption }: { items: unknown[]; caption: string }) {
  const list = asRows(items);
  if (!list.length) return null;
  return (
    <section>
      <h2 className="text-base font-semibold">{caption}</h2>
      <ul className="list-disc pl-5 text-sm">
        {list.slice(0, 40).map((item, i) => (
          <li key={i}>
            <strong>{cell(item.headline ?? item.title)}</strong>
            {item.datetime || item.published_at ? (
              <span> — {cell(item.datetime ?? item.published_at)}</span>
            ) : null}
            {item.summary ? <p>{cell(item.summary)}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PerformanceSummary({
  label,
  payload
}: {
  label: string;
  payload: Record<string, unknown> | null | undefined;
}) {
  if (!payload) return null;
  const perf = (payload.performance as Record<string, unknown>) || payload;
  const dynamic = Array.isArray(perf.dynamicPeriods) ? perf.dynamicPeriods : [];
  if (dynamic.length) {
    const rows = dynamic
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          period: row.period,
          return_pct: row.totalReturn ?? row.return_pct
        };
      })
      .filter((r) => r.period != null && r.return_pct != null);
    if (rows.length) {
      return (
        <SimpleTable
          caption={`${label} — period returns`}
          columns={[
            { key: 'period', label: 'Period' },
            { key: 'return_pct', label: 'Return %' }
          ]}
          rows={rows}
        />
      );
    }
  }
  const keys = ['1D', '5D', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', '20Y', 'YTD'];
  const rows = keys
    .map((k) => ({ period: k, return_pct: perf[k] ?? perf[k.toLowerCase()] }))
    .filter((r) => r.return_pct != null);
  if (!rows.length) return null;
  return (
    <SimpleTable
      caption={`${label} — period returns`}
      columns={[
        { key: 'period', label: 'Period' },
        { key: 'return_pct', label: 'Return %' }
      ]}
      rows={rows}
    />
  );
}

function tickerServerBlock(d: Record<string, unknown>, path: string) {
  const sym = String(d.symbol || path.split('/').pop() || '').toUpperCase();
  const perf = (d.returnsSym as Record<string, unknown> | undefined)?.performance as
    | Record<string, unknown>
    | undefined;

  return (
    <>
      <PerformanceSummary label={sym} payload={d.returnsSym as Record<string, unknown>} />
      <PerformanceSummary label="SPY benchmark" payload={d.returnsSpy as Record<string, unknown>} />
      <ReturnsSeriesBlock rows={perf?.annualReturns as unknown[]} caption={`${sym} annual returns`} />
      <ReturnsSeriesBlock rows={perf?.quarterlyReturns as unknown[]} caption={`${sym} quarterly returns`} />
      <ReturnsSeriesBlock rows={perf?.monthlyReturns as unknown[]} caption={`${sym} monthly returns`} />
      {d.ohlcRows ? (
        <OhlcTable rows={d.ohlcRows as unknown[]} caption={`${sym} OHLC (1 year)`} />
      ) : null}
      {d.ohlcSignalRows ? (
        <OhlcTable rows={d.ohlcSignalRows as unknown[]} caption={`${sym} OHLC with signals`} />
      ) : null}
    </>
  );
}

function StaticPageSection({ path }: { path: string }) {
  const staticCopy = STATIC_PAGE_SEO[path];
  if (!staticCopy) return null;
  return (
    <section className="text-sm">
      <h2>{staticCopy.heading}</h2>
      {staticCopy.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {staticCopy.links?.length ? (
        <ul className="list-disc pl-5">
          {staticCopy.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function routeFallbackBody(path: string): ReactNode {
  const sym = path.split('/').filter(Boolean).pop()?.toUpperCase();

  if (path.startsWith('/ticker/') && sym) {
    return (
      <section className="text-sm">
        <h2>{sym} stock price chart and returns</h2>
        <p>
          Daily OHLC price data, period returns, annual and quarterly performance, and Odin trading
          signals for {sym}.
        </p>
      </section>
    );
  }

  if (path.startsWith('/historical-data/') && sym) {
    return (
      <section className="text-sm">
        <h2>{sym} historical OHLC data</h2>
        <p>Downloadable historical open, high, low, close, and volume data for {sym}.</p>
      </section>
    );
  }

  if (path.startsWith('/indices/')) {
    const slug = path.split('/').pop() || 'index';
    return (
      <section className="text-sm">
        <h2>{slug.replace(/-/g, ' ')} index chart and constituents</h2>
        <p>Index performance, close price series, and constituent returns.</p>
      </section>
    );
  }

  if (path.startsWith('/sector-data/')) {
    const key = (path.split('/').pop() || 'sector').toUpperCase();
    return (
      <section className="text-sm">
        <h2>{key} sector ETF performance</h2>
        <p>Sector returns, price trend, and constituent stock data.</p>
      </section>
    );
  }

  if (path.includes('/statistic/ticker-') && sym) {
    return (
      <section className="text-sm">
        <h2>{sym} periodic returns and OHLC statistics</h2>
        <p>Return series and OHLC-based statistics for {sym}.</p>
      </section>
    );
  }

  if (path.startsWith('/ticker-report/') && sym) {
    return (
      <section className="text-sm">
        <h2>{sym} monthly performance report</h2>
        <p>Monthly return summary and signal analytics for {sym}.</p>
      </section>
    );
  }

  if (path.startsWith('/relative-performance/ticker/') && sym) {
    return (
      <section className="text-sm">
        <h2>{sym} relative performance vs benchmarks</h2>
        <p>Compare {sym} returns against SPY and sector peers.</p>
      </section>
    );
  }

  return null;
}

export function renderServerPageBody(pathname: string, data: unknown): ReactNode {
  const path = pathname.split('?')[0];

  if (STATIC_PAGE_SEO[path]) {
    return <StaticPageSection path={path} />;
  }

  if (!data || typeof data !== 'object') {
    return routeFallbackBody(path);
  }
  const d = data as Record<string, unknown>;

  if (path === '/return-table' && d.vals) {
    return <ReturnsValsTable vals={d.vals as Record<string, Record<string, number | undefined>>} />;
  }

  if (path === '/heatmap' && d.rows) {
    return <TickerDetailsTable rows={d.rows as unknown[]} caption="Market heatmap — constituents" />;
  }

  if (path === '/odin-signals' && d.indexRows) {
    return <TickerDetailsTable rows={d.indexRows as unknown[]} caption="Odin signals — index constituents" />;
  }

  if (path === '/market-movers' && d.points) {
    return <TickerDetailsTable rows={d.points as unknown[]} caption="Market movers" />;
  }

  if (path === '/news') {
    const hasNews =
      (d.generalItems as unknown[])?.length ||
      (d.indexItems as unknown[])?.length ||
      (d.tickerItems as unknown[])?.length;
    if (!hasNews) {
      return (
        <section className="text-sm">
          <p>Latest U.S. stock market headlines by ticker and index.</p>
        </section>
      );
    }
    return (
      <>
        <NewsList items={(d.generalItems as unknown[]) || []} caption="Market news" />
        <NewsList items={(d.indexItems as unknown[]) || []} caption="Index news" />
        <NewsList items={(d.tickerItems as unknown[]) || []} caption="Ticker news" />
      </>
    );
  }

  if (path.startsWith('/historical-data/')) {
    const sym = path.split('/').pop()?.toUpperCase() || 'Ticker';
    return (
      <>
        {d.company_name ? (
          <p className="text-sm">
            {String(d.company_name)} ({sym}) — OHLC preview ({cell(d.min_date)} to {cell(d.max_date)})
          </p>
        ) : null}
        {d.rows ? <OhlcTable rows={d.rows as unknown[]} caption={`${sym} historical OHLC`} /> : null}
      </>
    );
  }

  if (path.startsWith('/ticker/')) {
    return tickerServerBlock(d, path);
  }

  if (path.startsWith('/indices/') || path.startsWith('/sector-data/')) {
    const series = asRows(d.fullChartSeries).map((r) => ({
      date: r.date,
      close: r.close
    }));
    return (
      <>
        {series.length ? (
          <>
            <SvgSparkline rows={series} caption={`${d.slug} — close price trend`} />
            <SimpleTable
              caption={`${d.slug} — close price series`}
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'close', label: 'Close' }
              ]}
              rows={series}
            />
          </>
        ) : null}
        <PerformanceSummary label="SPY" payload={d.returnsSpy as Record<string, unknown>} />
      </>
    );
  }

  if (path.startsWith('/statistic-data') && d.ohlcRows) {
    return <OhlcTable rows={d.ohlcRows as unknown[]} caption="OHLC signals sample" />;
  }

  if (path.startsWith('/stock-splits') && d.splits) {
    return (
      <SimpleTable
        caption="Recent stock splits"
        columns={[
          { key: 'symbol', label: 'Symbol' },
          { key: 'execution_date', label: 'Date' },
          { key: 'split_ratio', label: 'Ratio' }
        ]}
        rows={asRows(d.splits).map((r) => ({
          symbol: r.symbol ?? r.ticker,
          execution_date: r.execution_date ?? r.date,
          split_ratio: r.split_ratio ?? r.ratio
        }))}
      />
    );
  }

  if (path.startsWith('/relative-performance/') && d.seriesData) {
    const series = d.seriesData as Record<string, unknown[]>;
    return (
      <>
        {Object.entries(series).map(([key, rows]) => (
          <OhlcTable key={key} rows={rows} caption={`Relative performance — ${key}`} />
        ))}
      </>
    );
  }

  if (path.includes('/statistic/ticker-')) {
    const sym = String(d.symbol || '').toUpperCase();
    return (
      <>
        {d.primaryReturnsRaw ? (
          <ReturnsSeriesBlock rows={d.primaryReturnsRaw as unknown[]} caption={`${sym} returns`} />
        ) : null}
        {d.annualReturnsRaw ? (
          <ReturnsSeriesBlock rows={d.annualReturnsRaw as unknown[]} caption={`${sym} annual returns`} />
        ) : null}
        {d.quarterlyReturnsRaw ? (
          <ReturnsSeriesBlock rows={d.quarterlyReturnsRaw as unknown[]} caption={`${sym} quarterly returns`} />
        ) : null}
        {d.monthlyReturnsRaw ? (
          <ReturnsSeriesBlock rows={d.monthlyReturnsRaw as unknown[]} caption={`${sym} monthly returns`} />
        ) : null}
        {d.statsRows ? (
          <OhlcTable rows={d.statsRows as unknown[]} caption={`${sym} OHLC statistics`} />
        ) : null}
      </>
    );
  }

  if (path.startsWith('/ticker-report/') && d.report) {
    const report = d.report as Record<string, unknown>;
    const meta = (report.meta as Record<string, unknown>) || report;
    return (
      <article className="text-sm">
        <h2>{cell(meta.title ?? `${d.symbol} monthly report`)}</h2>
        <p>{cell(meta.summary ?? meta.description ?? report.summary)}</p>
      </article>
    );
  }

  if (path === '/market') {
    return (
      <>
        {d.summaryReturns ? (
          <ReturnsValsTable
            vals={d.summaryReturns as Record<string, Record<string, number | undefined>>}
          />
        ) : null}
        {d.watchlistRows ? (
          <TickerDetailsTable rows={d.watchlistRows as unknown[]} caption="Market watchlist snapshot" />
        ) : null}
        {d.heatmapThumb ? (
          <TickerDetailsTable rows={d.heatmapThumb as unknown[]} caption="Heatmap snapshot" />
        ) : null}
      </>
    );
  }

  if (path === '/premium') {
    return (
      <section className="text-sm">
        <h2>Odin500 Pricing</h2>
        <p>
          Free plan with market dashboards and basic signals, or Odin500 Pro for $10/month with full
          index, ETF, and Odin trading-signal access.
        </p>
      </section>
    );
  }

  return null;
}
