/** Rotating chart colors for Other Markets (ETFs) rows. */
const OTHER_PALETTE = [
  { color: '#3b82f6', badge: '#1e3a8a', tone: 'blue' },
  { color: '#2563eb', badge: '#172554', tone: 'blue' },
  { color: '#6366f1', badge: '#312e81', tone: 'indigo' },
  { color: '#8b5cf6', badge: '#4c1d95', tone: 'purple' },
  { color: '#7a2fff', badge: '#5b21b6', tone: 'purple' },
  { color: '#06b6d4', badge: '#155e75', tone: 'cyan' },
  { color: '#10b981', badge: '#064e3b', tone: 'green' },
  { color: '#22c55e', badge: '#14532d', tone: 'green' },
  { color: '#eab308', badge: '#713f12', tone: 'gold' },
  { color: '#f59e0b', badge: '#78350f', tone: 'gold' },
  { color: '#ff6b00', badge: '#9a3412', tone: 'orange' },
  { color: '#ef4444', badge: '#7f1d1d', tone: 'red' },
  { color: '#ec4899', badge: '#831843', tone: 'pink' },
  { color: '#94a3b8', badge: '#334155', tone: 'gray' },
  { color: '#64748b', badge: '#1e293b', tone: 'gray' },
  { color: '#0f766e', badge: '#134e4a', tone: 'teal' }
];

/** Subsections inside “Other Markets (ETFs)” on the market page sidebar. */
export const OTHER_MARKET_SUBSECTIONS = [
  { id: 'us-index-etf', title: 'Other US Index ETFs' },
  { id: 'foreign', title: 'Foreign Indices' },
  { id: 'commodities', title: 'Commodities ETFs' },
  { id: 'leveraged', title: 'Leveraged ETFs' },
  { id: 'inverse', title: 'Inverse ETFs' }
];

/**
 * Other Markets rows.
 * Tuple: [key, label, ohlcTicker, fundName, subsectionId, optionalDisplaySymbol]
 */
const OTHER_MARKET_ROWS = [
  ['RSP', 'SP500 Equal Weight', 'RSP', 'Invesco S&P 500 Equal Weight ETF', 'us-index-etf'],
  ['IWF', 'Russel 1000', 'IWF', 'iShares Russell 1000 Growth ETF', 'us-index-etf'],
  ['SPMD', 'S&P MidCap', 'SPMD', 'SPDR Portfolio Mid Cap ETF', 'us-index-etf'],

  ['N225', 'Japan Nikkei 225', 'N225', 'Nikkei 225', 'foreign'],
  ['HSI', 'Hong Kong Hang Seng', 'HSI', 'Hang Seng Index', 'foreign', '^HSI'],
  ['FTSE', 'UK FTSE', 'FTSE', 'FTSE 100 Index', 'foreign'],
  ['FCHI', 'France CAC40', 'FCHI', 'CAC 40 Index', 'foreign'],
  ['IBEX', 'Spain IBEX', 'Ibex', 'IBEX 35 Index', 'foreign', '^Ibex'],
  ['TA35TA', 'Israel TA35', 'TA35.TA', 'Tel Aviv 35 Index', 'foreign', 'TA35.TA'],

  ['GLD', 'Gold', 'GLD', 'SPDR Gold Shares', 'commodities'],
  ['SLV', 'Silver', 'SLV', 'iShares Silver Trust', 'commodities'],
  ['USO', 'Oil', 'USO', 'United States Oil Fund', 'commodities'],
  ['UNG', 'Natural Gas', 'UNG', 'United States Natural Gas Fund', 'commodities'],

  ['SSO', 'ProShares Ultra S&P 500', 'SSO', 'ProShares Ultra S&P 500', 'leveraged'],
  ['SPXL', 'Direxion Daily S&P 500 Bull 3X Shares', 'SPXL', 'Direxion Daily S&P 500 Bull 3X Shares', 'leveraged'],
  ['QLD', 'ProShares Ultra QQQ', 'QLD', 'ProShares Ultra QQQ', 'leveraged'],
  ['TQQQ', 'ProShares UltraPro QQQ', 'TQQQ', 'ProShares UltraPro QQQ', 'leveraged'],
  ['WEBL', 'Direxion Daily Dow Jones Internet Bull 3X Shares', 'WEBL', 'Direxion Daily Dow Jones Internet Bull 3X Shares', 'leveraged'],

  ['SH', 'ProShares Short S&P500', 'SH', 'ProShares Short S&P500', 'inverse'],
  ['SDS', 'ProShares UltraShort S&P500', 'SDS', 'ProShares UltraShort S&P500', 'inverse'],
  ['SPXS', 'Direxion Daily S&P 500 Bear 3X Shares', 'SPXS', 'Direxion Daily S&P 500 Bear 3X Shares', 'inverse'],
  ['PSQ', 'ProShares Short QQQ', 'PSQ', 'ProShares Short QQQ', 'inverse'],
  ['QID', 'ProShares UltraShort QQQ', 'QID', 'ProShares UltraShort QQQ', 'inverse'],
  ['SQQQ', 'ProShares UltraPro Short QQQ', 'SQQQ', 'ProShares UltraPro Short QQQ', 'inverse']
];

/** Chart/checkbox colors for Index ETF rows only (not used by US indices, sectors, or other markets). */
const INDEX_ETF_COLORS = {
  QQQ: { color: '#84cc16', badge: '#3f6212', tone: 'lime' },
  DIA: { color: '#2dd4bf', badge: '#0f5c55', tone: 'turquoise' },
  SPY: { color: '#db2777', badge: '#701a3f', tone: 'rose' }
};

function buildOtherMarketSeries() {
  return OTHER_MARKET_ROWS.map((row, i) => {
    const [key, label, ticker, addon, subsection, symbol] = row;
    const pal = OTHER_PALETTE[i % OTHER_PALETTE.length];
    return {
      key,
      label,
      ticker,
      symbol: symbol || ticker,
      addon,
      subsection,
      color: pal.color,
      badge: pal.badge,
      tone: pal.tone,
      group: 'other'
    };
  });
}

export const MARKET_SERIES = [
  /** `symbol` = short label in UI (e.g. DJI); `ticker` = OHLC / API symbol (e.g. DIA). */
  { key: 'NDX', label: 'Nasdaq 100', ticker: 'NDX', symbol: 'NDX', indexRouteSlug: 'nasdaq-100', color: '#7a2fff', badge: '#5b21b6', tone: 'purple', group: 'us' },
  { key: 'INDU', label: 'Dow Jones', ticker: 'DJI', symbol: 'DJI', indexRouteSlug: 'dow-jones', color: '#ff6b00', badge: '#9a3412', tone: 'orange', group: 'us' },
  { key: 'SPX', label: 'S&P 500', ticker: 'SPX', symbol: 'SPX', indexRouteSlug: 'sp500', color: '#56208E', badge: '#1e40af', tone: 'blue', group: 'us' },
  {
    key: 'QQQ',
    label: 'Nasdaq 100',
    ticker: 'QQQ',
    symbol: 'QQQ',
    group: 'index',
    ...INDEX_ETF_COLORS.QQQ
  },
  {
    key: 'DIA',
    label: 'Dow Jones',
    ticker: 'DIA',
    symbol: 'DIA',
    group: 'index',
    ...INDEX_ETF_COLORS.DIA
  },
  {
    key: 'SPY',
    label: 'S&P 500',
    ticker: 'SPY',
    symbol: 'SPY',
    group: 'index',
    ...INDEX_ETF_COLORS.SPY
  },


  { key: 'XLB', label: 'Materials', ticker: 'XLB', addon: 'Select Sector SPDR Fund', color: '#6b7280', badge: '#374151', tone: 'gray', group: 'sector' },
  { key: 'XLK', label: 'Technology', ticker: 'XLK', addon: 'Select Sector SPDR Fund', color: '#00b894', badge: '#065f46', tone: 'teal', group: 'sector' },
  { key: 'XLF', label: 'Financials', ticker: 'XLF', addon: 'Select Sector SPDR Fund', color: '#ff3b3b', badge: '#7f1d1d', tone: 'red', group: 'sector' },
  { key: 'XLV', label: 'Healthcare', ticker: 'XLV', color: '#812046', badge: '#075985', tone: 'sky', group: 'sector' },
  { key: 'XLI', label: 'Industrials', ticker: 'XLI', addon: 'Select Sector SPDR Fund', color: '#a16207', badge: '#422006', tone: 'brown', group: 'sector' },
  { key: 'XLE', label: 'Energy', ticker: 'XLE', addon: 'Select Sector SPDR Fund', color: '#d4af37', badge: '#78350f', tone: 'gold', group: 'sector' },
  { key: 'XLY', label: 'Consumer Discretionary', ticker: 'XLY', addon: 'Select Sector SPDR Fund', color: '#95658A', badge: '#7c2d12', tone: 'orange', group: 'sector' },
  { key: 'XLP', label: 'Consumer Staples', ticker: 'XLP', addon: 'Select Sector SPDR Fund', color: '#22c55e', badge: '#14532d', tone: 'green', group: 'sector' },
  { key: 'XLU', label: 'Utilities', ticker: 'XLU', addon: 'Select Sector SPDR Fund', color: '#a78bfa', badge: '#4c1d95', tone: 'purple', group: 'sector' },
  { key: 'XLRE', label: 'Real Estate', ticker: 'XLRE', addon: 'Select Sector SPDR Fund', color: '#ec4899', badge: '#831843', tone: 'pink', group: 'sector' },
  { key: 'XLC', label: 'Communication Services', ticker: 'XLC', addon: 'Select Sector SPDR Fund', color: '#06b6d4', badge: '#155e75', tone: 'cyan', group: 'sector' },

  ...buildOtherMarketSeries()
];

export const META_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s]));
export const TICKER_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s.ticker]));
export const DEFAULT_SELECTED_KEYS = ['INDU', 'SPX', 'NDX', 'XLK'];

/** Chip / legend label; Index ETF group is prefixed with “ETF ”. */
export function marketSeriesChipLabel(meta) {
  if (!meta) return '';
  const name = String(meta.label || meta.key || '').trim();
  if (meta.group === 'index') return name ? `ETF ${name}` : 'ETF';
  return name;
}
