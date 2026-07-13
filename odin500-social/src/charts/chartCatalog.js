/**
 * Curated charts for Admin "Generate from chart" social drafts.
 * Selectors prefer export-modal plot hosts where they exist.
 */

function statsPeriodCharts(period, pathSegment, { includeBars = true } = {}) {
  const title = period.charAt(0).toUpperCase() + period.slice(1);
  const base = `/statistic/ticker-${pathSegment}/{symbol}`;
  const charts = [];

  if (includeBars) {
    charts.push({
      id: `stats-${pathSegment}-bars`,
      label: `${title} returns bars`,
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-annual-figma__section--chartjs .ticker-annual-figma__chart-card--chartjs',
      fallbackSelector: '.ticker-annual-figma__chart-card--chartjs',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    });
  }

  charts.push(
    {
      id: `stats-${pathSegment}-posneg`,
      label: `${title} pos/neg + min/max`,
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-annual-figma__split',
      fallbackSelector: '.ticker-annual-figma__chart-card--donut',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    },
    {
      id: `stats-${pathSegment}-magnitude-donuts`,
      label: `${title} magnitude donuts`,
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-annual-donut__split',
      fallbackSelector: '.ticker-annual-donut',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    }
  );

  if (pathSegment === 'quarterly') {
    charts.push({
      id: 'stats-quarterly-dual',
      label: 'Quarterly by year / by quarter',
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-quarterly__split',
      fallbackSelector: '.ticker-quarterly',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    });
  }

  if (pathSegment === 'monthly' || pathSegment === 'weekly') {
    charts.push({
      id: `stats-${pathSegment}-calendar`,
      label: `${title} returns by year`,
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-monthly .ticker-annual-figma__chart-card--chartjs',
      fallbackSelector: '.ticker-monthly .ticker-annual-figma__chart-card',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    });
  }

  if (pathSegment === 'monthly') {
    charts.push({
      id: 'stats-monthly-waterfall',
      label: 'Monthly waterfall + month mix',
      group: 'Stats',
      requiresSymbol: true,
      pagePathTemplate: base,
      selector: '.ticker-monthly-adv__split',
      fallbackSelector: '.ticker-monthly-adv',
      campaign: 'ticker_spotlight',
      contextKind: 'stats'
    });
  }

  return charts;
}

const CHARTS = [
  {
    id: 'ticker-ohlc',
    label: 'Ticker main OHLC',
    group: 'Ticker',
    requiresSymbol: true,
    pagePathTemplate: '/ticker/{symbol}',
    selector: '.ticker-chart-plot-host',
    fallbackSelector: '.ticker-chart-body--main',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },
  {
    id: 'ticker-benchmark-bars',
    label: 'Benchmark vs ticker bars',
    group: 'Ticker',
    requiresSymbol: true,
    pagePathTemplate: '/ticker/{symbol}',
    selector: '.ticker-s24__chart-wrap',
    fallbackSelector: '.ticker-s24__chart-shell',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },

  // Legacy id — same crop as stats-annual-bars
  {
    id: 'ticker-annual',
    label: 'Annual returns bars',
    group: 'Stats',
    requiresSymbol: true,
    pagePathTemplate: '/statistic/ticker-annual/{symbol}',
    selector: '.ticker-annual-figma__section--chartjs .ticker-annual-figma__chart-card--chartjs',
    fallbackSelector: '.ticker-annual-figma__chart-card--chartjs',
    campaign: 'ticker_spotlight',
    contextKind: 'stats'
  },
  ...statsPeriodCharts('annual', 'annual', { includeBars: false }),
  ...statsPeriodCharts('quarterly', 'quarterly'),
  ...statsPeriodCharts('monthly', 'monthly'),
  ...statsPeriodCharts('weekly', 'weekly'),
  ...statsPeriodCharts('daily', 'daily'),

  {
    id: 'rs-main-line',
    label: 'Relative strength line',
    group: 'Relative strength',
    requiresSymbol: true,
    pagePathTemplate: '/relative-performance/ticker/{symbol}',
    selector: '.relative-strength-page__chart-host-inner',
    fallbackSelector: '.relative-strength-page__chart-card .np-chart-wrap',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },
  {
    id: 'ticker-rs',
    label: 'RS annual vs benchmark',
    group: 'Relative strength',
    requiresSymbol: true,
    pagePathTemplate: '/relative-performance/ticker/{symbol}',
    selector:
      '.stats-cmp-charts .relative-strength-page__cmp-chart-block:nth-of-type(1) .stats-cmp-chart__plot-host',
    fallbackSelector: '.stats-cmp-charts .stats-cmp-chart__plot-host',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },
  {
    id: 'rs-excess-vs-bench',
    label: 'Excess return line',
    group: 'Relative strength',
    requiresSymbol: true,
    pagePathTemplate: '/relative-performance/ticker/{symbol}',
    selector:
      '.stats-cmp-charts .relative-strength-page__cmp-chart-block:nth-of-type(2) .stats-cmp-chart__plot-host',
    fallbackSelector: '.stats-cmp-charts .stats-cmp-chart__plot-host',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },
  {
    id: 'rs-periodic-vs-bench',
    label: 'Periodic returns vs benchmark',
    group: 'Relative strength',
    requiresSymbol: true,
    pagePathTemplate: '/relative-performance/ticker/{symbol}',
    selector:
      '.stats-cmp-charts .relative-strength-page__cmp-chart-block:nth-of-type(3) .stats-cmp-chart__plot-host',
    fallbackSelector: '.stats-cmp-charts .stats-cmp-chart__plot-host',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },
  {
    id: 'rs-benchmark-bars',
    label: 'Benchmark vs ticker bars',
    group: 'Relative strength',
    requiresSymbol: true,
    pagePathTemplate: '/relative-performance/ticker/{symbol}',
    selector: '.ticker-s24__chart-wrap',
    fallbackSelector: '.ticker-s24__chart-shell',
    campaign: 'ticker_spotlight',
    contextKind: 'ohlc'
  },

  {
    id: 'market-center',
    label: 'Market performance chart',
    group: 'Market',
    requiresSymbol: false,
    pagePath: '/market',
    selector: '.mkt-center > .np-card',
    fallbackSelector: '.np-card',
    campaign: 'daily_pulse',
    contextKind: 'market'
  },
  {
    id: 'heatmap',
    label: 'Sector heatmap',
    group: 'Market',
    requiresSymbol: false,
    pagePath: '/heatmap',
    selector: '.heatmap-main__viz',
    fallbackSelector: '.heatmap-main',
    campaign: 'daily_pulse',
    contextKind: 'market'
  },
  {
    id: 'movers-bars',
    label: 'Top gainers bars',
    group: 'Market',
    requiresSymbol: false,
    pagePath: '/market-movers',
    selector: '.market-movers-page__bar-frame',
    fallbackSelector: '.market-movers-page__bars-grid',
    campaign: 'daily_pulse',
    contextKind: 'market'
  },
  {
    id: 'movers-both-panels',
    label: 'Gainers + losers bars',
    group: 'Market',
    requiresSymbol: false,
    pagePath: '/market-movers',
    selector: '.market-movers-page__charts-viz',
    fallbackSelector: '.market-movers-page__bars-grid',
    campaign: 'daily_pulse',
    contextKind: 'market'
  }
];

const BY_ID = new Map(CHARTS.map((c) => [c.id, c]));

function fillSymbolPath(template, symbol) {
  const sym = String(symbol || '').trim().toLowerCase();
  return template.replace(/\{symbol\}/gi, encodeURIComponent(sym));
}

function listCharts() {
  return CHARTS.map(({ id, label, group, requiresSymbol }) => ({
    id,
    label,
    group,
    requiresSymbol
  }));
}

/**
 * @param {string} chartId
 * @param {{ symbol?: string }} [opts]
 */
function resolveChart(chartId, opts = {}) {
  const entry = BY_ID.get(String(chartId || '').trim());
  if (!entry) {
    const err = new Error(
      `Unknown chartId: ${chartId}. Available: ${CHARTS.map((c) => c.id).join(', ')}`
    );
    err.status = 400;
    throw err;
  }

  const symbol = opts.symbol ? String(opts.symbol).trim().toUpperCase() : '';
  if (entry.requiresSymbol && !symbol) {
    const err = new Error(`Symbol is required for chart "${entry.id}"`);
    err.status = 400;
    throw err;
  }

  const pagePath = entry.pagePathTemplate
    ? fillSymbolPath(entry.pagePathTemplate, symbol)
    : entry.pagePath;

  return {
    chartId: entry.id,
    label: entry.label,
    group: entry.group,
    requiresSymbol: entry.requiresSymbol,
    symbol: symbol || undefined,
    pagePath,
    selector: entry.selector,
    fallbackSelector: entry.fallbackSelector,
    campaign: entry.campaign,
    contextKind: entry.contextKind
  };
}

function chartCount() {
  return CHARTS.length;
}

module.exports = {
  CHARTS,
  listCharts,
  resolveChart,
  chartCount
};
