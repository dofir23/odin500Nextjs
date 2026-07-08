import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

function patch(file, replacements) {
  const full = path.join(root, file);
  let content = fs.readFileSync(full, 'utf8');
  let changed = 0;
  for (const [oldStr, newStr] of replacements) {
    if (!content.includes(oldStr)) {
      console.error(`MISSING in ${file}:`, oldStr.slice(0, 80));
      process.exitCode = 1;
      continue;
    }
    content = content.replace(oldStr, newStr);
    changed++;
  }
  fs.writeFileSync(full, content, 'utf8');
  console.log(`patched ${file} (${changed} replacements)`);
}

patch('odin500-frontend/src/ssr/fetchPageData.ts', [
  [
    `  return sym || fallback;
}

function ohlcRowsFromPayload`,
    `  return sym || fallback;
}

/** Bounded history window for statistic tables (avoids full 1980→today BQ scans). */
function statisticHistoryStartDate(endDate?: string) {
  const end = endDate || new Date().toISOString().slice(0, 10);
  const d = new Date(\`\${end}T12:00:00\`);
  d.setFullYear(d.getFullYear() - 35);
  return d.toISOString().slice(0, 10);
}

function ohlcRowsFromPayload`,
  ],
  [
    `    postMarketJson('/api/market/ticker-details', { index: 'Dow Jones', period: 'last-date' }),
    postMarketJson('/api/market/ticker-details', { index: 'Dow Jones', period: 'last-date' }),
    summaryTickers.length ? fetchTickerReturnsBatch(summaryTickers) : Promise.resolve(null)`,
    `    postMarketJson('/api/market/ticker-details', { index: 'Dow Jones', period: 'last-date' }),
    summaryTickers.length ? fetchTickerReturnsBatch(summaryTickers) : Promise.resolve(null)`,
  ],
  [
    `  const [coreRes, spyRes, annualRes, quarterlyRes, monthlyRes, ohlcRes, signalRes] = await Promise.all([
    postMarketJson('/api/market/ticker-core-returns', body),
    postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
    postMarketJson('/api/market/ticker-annual-returns', body),
    postMarketJson('/api/market/ticker-quarterly-returns', body),
    postMarketJson('/api/market/ticker-monthly-returns', body),
    getMarketJson(
      \`/api/market/ohlc?symbol=\${encodeURIComponent(sym)}&start_date=\${encodeURIComponent(ohlcStart)}&end_date=\${encodeURIComponent(end)}&limit=400\`
    ),
    postMarketJson('/api/market/ohlc-signals-indicator', {
      ticker: sym,
      start_date: ohlcStart,
      end_date: end
    })
  ]);

  if (!coreRes && !spyRes) return null;

  let returnsSym: Record<string, unknown> | null = coreRes;
  for (const patch of [annualRes, quarterlyRes, monthlyRes]) {
    returnsSym = mergeTickerReturnsPayload(returnsSym, patch);
  }

  return {
    symbol: sym,
    returnsSym,
    returnsSpy: spyRes,
    asOfDate: String(returnsSym?.asOfDate || coreRes?.asOfDate || end).slice(0, 10),
    ohlcRows: ohlcRowsFromPayload(ohlcRes),
    ohlcSignalRows: ohlcRowsFromPayload(signalRes)
  };`,
    `  const [coreRes, spyRes, annualRes, quarterlyRes, monthlyRes, signalRes] = await Promise.all([
    postMarketJson('/api/market/ticker-core-returns', body),
    postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
    postMarketJson('/api/market/ticker-annual-returns', body),
    postMarketJson('/api/market/ticker-quarterly-returns', body),
    postMarketJson('/api/market/ticker-monthly-returns', body),
    postMarketJson('/api/market/ohlc-signals-indicator', {
      ticker: sym,
      start_date: ohlcStart,
      end_date: end
    })
  ]);

  if (!coreRes && !spyRes) return null;

  let returnsSym: Record<string, unknown> | null = coreRes;
  for (const patch of [annualRes, quarterlyRes, monthlyRes]) {
    returnsSym = mergeTickerReturnsPayload(returnsSym, patch);
  }

  const signalRows = ohlcRowsFromPayload(signalRes);

  return {
    symbol: sym,
    returnsSym,
    returnsSpy: spyRes,
    asOfDate: String(returnsSym?.asOfDate || coreRes?.asOfDate || end).slice(0, 10),
    ohlcRows: signalRows,
    ohlcSignalRows: signalRows
  };`,
  ],
  [
    `  const endDate = new Date().toISOString().slice(0, 10);
  const payload = await postMarketJson('/api/market/ohlc-signals-indicator', {
    ticker: sym,
    start_date: '1980-01-01',
    end_date: endDate
  });`,
    `  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = statisticHistoryStartDate(endDate);
  const payload = await postMarketJson('/api/market/ohlc-signals-indicator', {
    ticker: sym,
    start_date: startDate,
    end_date: endDate
  });`,
  ],
]);

patch('odin500-frontend/src/views/StatisticDataPage.jsx', [
  [
    `        const startDate = '1980-01-01';
        const endDate = todayIso();`,
    `        const endDate = todayIso();
        const startD = new Date(\`\${endDate}T12:00:00\`);
        startD.setFullYear(startD.getFullYear() - 35);
        const startDate = startD.toISOString().slice(0, 10);`,
  ],
  [
    `          ttlMs: 10 * 60 * 1000`,
    `          ttlMs: 60 * 60 * 1000`,
  ],
]);

patch('odin500-frontend/src/views/TickerPage.jsx', [
  [
    `  const [ohlcRows, setOhlcRows] = useState([]);`,
    `  const [ohlcRows, setOhlcRows] = useState(() =>
    ssrSeed?.ohlcSignalRows?.length ? sortRowsAsc(ssrSeed.ohlcSignalRows) : []
  );`,
  ],
  [
    `    if (!canFetchMarketData()) {
      setChartLoading(false);
      setOhlcRows([]);
      return;
    }

    (async () => {
      const chartStartedAt = performance.now();
      setChartLoading(true);
      setOhlcRows([]);
      try {
        const { start, end } = chartApiRange;
        const ohlcRes = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: sym, start_date: start, end_date: end },
          ttlMs: 2 * 60 * 1000
        });`,
    `    if (!canFetchMarketData()) {
      setChartLoading(false);
      setOhlcRows([]);
      return;
    }

    const { start, end } = chartApiRange;
    const ssrChartSeeded =
      ssrSeed?.ohlcSignalRows?.length &&
      String(ssrSeed.symbol || '').toUpperCase() === String(sym).toUpperCase() &&
      !appliedCustomRange &&
      timeframe === '1Y' &&
      ssrSeed.asOfDate;
    if (ssrChartSeeded) {
      const seedEnd = String(ssrSeed.asOfDate).slice(0, 10);
      const seedStartD = new Date(\`\${seedEnd}T12:00:00\`);
      seedStartD.setFullYear(seedStartD.getFullYear() - 1);
      const seedStart = seedStartD.toISOString().slice(0, 10);
      if (start === seedStart && end === seedEnd) {
        setChartLoading(false);
        return () => {
          cancelled = true;
        };
      }
    }

    (async () => {
      const chartStartedAt = performance.now();
      setChartLoading(true);
      try {
        const ohlcRes = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: sym, start_date: start, end_date: end },
          ttlMs: 60 * 60 * 1000
        });`,
  ],
  [
    `  }, [sym, timeframe, asOfDate, authVersion, chartApiRange.start, chartApiRange.end, symbolRefreshToken]);`,
    `  }, [sym, timeframe, asOfDate, authVersion, chartApiRange.start, chartApiRange.end, symbolRefreshToken, appliedCustomRange, ssrSeed]);`,
  ],
]);

patch('odin500-backend/.env.example', [
  [
    `# MARKET_SNAPSHOT_REFRESH_MS=300000`,
    `# MARKET_SNAPSHOT_REFRESH_MS=3600000`,
  ],
  [
    `# POST /api/market/ticker-returns — seconds (default 300). Lower for testing cache expiry.
# TICKER_RETURNS_CACHE_TTL_SECS=300`,
    `# POST /api/market/ticker-returns — seconds (default 3600). Lower for testing cache expiry.
# TICKER_RETURNS_CACHE_TTL_SECS=3600`,
  ],
  [
    `# Prewarm ticker-returns cache for popular symbols at startup + interval.
# ENABLE_TICKER_RETURNS_PREWARM=1
# TICKER_RETURNS_PREWARM_TICKERS=AAPL,MSFT,NVDA
# TICKER_RETURNS_PREWARM_INTERVAL_MS=300000`,
    `# Prewarm ticker-returns cache (off by default — each run hits BigQuery heavily).
# ENABLE_TICKER_RETURNS_PREWARM=1
# TICKER_RETURNS_PREWARM_TICKERS=AAPL,MSFT,NVDA
# TICKER_RETURNS_PREWARM_INTERVAL_MS=3600000`,
  ],
  [
    `# ENABLE_TICKER_RETURNS_ON_DEMAND_PREWARM=1`,
    `# ENABLE_TICKER_RETURNS_ON_DEMAND_PREWARM=0`,
  ],
  [
    `# OHLC signals indicator cache (default 3600s)
# OHLC_SIGNALS_INDICATOR_CACHE_TTL_SECS=3600`,
    `# OHLC signals indicator cache (default 3600s)
# OHLC_SIGNALS_INDICATOR_CACHE_TTL_SECS=3600`,
  ],
]);

// Add OHLC_SIGNALS line if missing
const envExample = path.join(root, 'odin500-backend/.env.example');
let envContent = fs.readFileSync(envExample, 'utf8');
if (!envContent.includes('OHLC_SIGNALS_INDICATOR_CACHE_TTL_SECS')) {
  envContent = envContent.replace(
    '# TICKER_RETURNS_CACHE_TTL_SECS=3600',
    `# TICKER_RETURNS_CACHE_TTL_SECS=3600
# POST /api/market/ohlc-signals-indicator — seconds (default 3600)
# OHLC_SIGNALS_INDICATOR_CACHE_TTL_SECS=3600`
  );
  fs.writeFileSync(envExample, envContent, 'utf8');
  console.log('patched odin500-backend/.env.example (added OHLC_SIGNALS line)');
}

console.log('done');
