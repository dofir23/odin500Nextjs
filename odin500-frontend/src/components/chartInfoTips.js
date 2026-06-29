'use client';
/**
 * End-user help copy for chart info buttons (see ChartInfoTip / DataInfoTip).
 * Keep language plain; avoid API paths and internal field names.
 */

/** @typedef {{ data: string, calculation: string, example: string }} ChartInfoTipContent */

export const CHART_INFO_TIPS = {
  normalizedPerformance: {
    data: 'Compares how selected indices performed over the time range you chose, all starting from the same baseline (0%).',
    calculation:
      'Each line shows percent change from the first trading day in the range to each later close. Lines move together when markets trend together and apart when they diverge.',
    example: 'If a line rises from 0% to +5%, that index gained about 5% over the period shown.'
  },
  marketIndexReturns: {
    data: 'Quick snapshot of how major U.S. indices did over common windows: 1 day, 1 month, 6 months, and 1 year.',
    calculation: 'Each cell is the total percent return for that index over that period, using official index prices.',
    example: 'A cell of +8.2% means the index was up 8.2% for that timeframe.'
  },
  marketHeatmapThumb: {
    data: 'Mini heatmap of stocks in the selected index, colored by how much each name moved in the latest period.',
    calculation: 'Tile color reflects return (green up, red down). Larger tiles represent bigger weight in the index view.',
    example: 'A deep green tile is a strong gainer; a red tile is a loser for that snapshot.'
  },
  tickerRelativeStrength: {
    data: 'Shows how this symbol performed versus a benchmark across standard periods (1 day through year-to-date).',
    calculation:
      'Each row is the symbol’s return for that period. The small bars show the gap versus the benchmark (symbol return minus benchmark return).',
    example: 'Symbol +4%, benchmark +1% → the bar reads about +3 points of relative strength.'
  },
  tickerCompareBars: {
    data: 'Side-by-side bars for the stock and its benchmark from 1 day out to 20 years.',
    calculation:
      'Each pair uses the same time window so you can see when the stock beat or lagged the benchmark. Taller bar = higher total return for that window.',
    example: 'If the stock bar is above the benchmark bar on 1Y, the stock outperformed over the last year.'
  },
  tickerAnnualReturns: {
    data: 'One bar per calendar year showing total return for that year.',
    calculation:
      'Return is price change from the first to the last trading day of the year. The orange average line is the simple average of the yearly returns shown.',
    example: 'A bar at +12% means the stock finished that calendar year up about 12%.'
  },
  tickerAnnualStats: {
    data: 'Summary of how often returns were positive vs negative, plus max, min, average, and median for the filtered years.',
    calculation:
      'Counts and stats use the same yearly returns as the bar chart above, limited to your selected date range.',
    example: '“Positive years: 7” means seven calendar years in range had a gain.'
  },
  heatmapTreemap: {
    data: 'Market map of stocks in the chosen index, grouped by sector and sized by importance in the view.',
    calculation:
      'Color shows return for the active period (slider adjusts how strong colors are). Zoom and filters narrow which names appear.',
    example: 'Widen the color scale to ±10% if you want subtler moves to still show color.'
  },
  odinOmxGauge: {
    data: 'Single score from 0 (most bearish) to 100 (most bullish) summarizing Odin signal mix for the selected index.',
    calculation:
      'Each stock’s latest signal (L1–L3 bullish, S1–S3 bearish, N neutral) is weighted and averaged into one number.',
    example: 'A reading near 70 suggests more bullish than bearish signals in the basket.'
  },
  odinDirectionDonut: {
    data: 'Share of stocks currently tagged Long, Short, or Neutral by Odin signals.',
    calculation: 'Long = L1+L2+L3, Short = S1+S2+S3, Neutral = N. Slice size is each group’s percent of the total.',
    example: 'A 60% Long slice means most names carry a bullish signal bucket.'
  },
  odinSignalDonut: {
    data: 'Breakdown of stocks by detailed signal level (L1, L2, L3, N, S3, S2, S1).',
    calculation: 'Each ticker counts once in its signal bucket; percentages are bucket count ÷ all tickers.',
    example: 'If L1 is 20% of the donut, one in five stocks is on the strongest long signal.'
  },
  odinSignalTreemap: {
    data: 'Treemap of the same index grouped by Odin signal strength instead of sector.',
    calculation: 'Tiles are colored by signal type; larger tiles mean more names (or weight) in that signal group.',
    example: 'A large L1 block means many stocks share the top bullish signal.'
  },
  marketMoversScatter: {
    data:
      'Every dot is one stock in the selected index. Up/down position is return for the tab you picked (1D, 5D, MTD, etc.). Left/right is relative volume (today vs its recent average).',
    calculation:
      'Return uses the same window as the chart title. Relative volume is how many times today’s volume compares to the 10-day average. Drag to pan; scroll to zoom when enabled.',
    example: 'A dot at +3% and 2.0× volume is a stock up ~3% on roughly double its usual trading activity.'
  },
  tickerMainChart: {
    data: 'Price history for the selected symbol with optional Odin signal markers on the timeline.',
    calculation:
      'Candlesticks or lines use daily open, high, low, and close. The timeframe buttons change how many sessions load.',
    example: 'Switching to 1Y loads about one year of sessions on the chart.'
  },
  tickerHeaderPrice: {
    data: 'Latest price and day change shown at the top of the ticker page.',
    calculation:
      'Price is the most recent closing price. Day change is today’s close minus the previous session’s close.',
    example: 'Price $150.25 and +1.2% means the last close is up 1.2% from the prior day.'
  },
  tickerNews: {
    data: 'Recent headlines tied to this symbol.',
    calculation: 'Stories are pulled from the live news feed and filtered to the ticker you are viewing.',
    example: 'Open News to see the full list and read articles on the dedicated news page.'
  },
  tickerSignalLadder: {
    data: 'Visual ladder of Odin signal buckets for the latest session on this chart.',
    calculation:
      'The highlighted step matches the signal on the last day of the loaded chart range. L1–L3 are bullish steps; S1–S3 are bearish; N is neutral.',
    example: 'If the last day is L2, the middle bullish rung is emphasized.'
  },
  tickerKeyData: {
    data: 'Key statistics: 52-week range, average volume, volatility, and related names in the same sector.',
    calculation:
      'Range and volume use about one year of daily prices. Volatility is an annualized estimate from daily moves. Related tickers share the same sector when available.',
    example: '52-week high/low are the highest high and lowest low in the past year of trading.'
  },
  tickerRelativeStrengthPanel: {
    data: 'Pick an index and a stock to compare period returns side by side.',
    calculation: 'Relative strength in the table is the stock’s return minus the index return for each row.',
    example: 'Stock +5% and index +2% on 1M → relative strength about +3 points.'
  },
  indexHeaderPrice: {
    data: 'Latest level and day change for this index or sector ETF.',
    calculation:
      'Uses the most recent official index or ETF prices when available; otherwise the last point on the index return series.',
    example: '+0.8% means the index closed up about 0.8% versus the prior session.'
  },
  indexNews: {
    data: 'Headlines for the symbol shown on this index or sector page.',
    calculation: 'Filtered from the live news feed for the active ticker (index proxy or sector ETF).',
    example: 'Use News to open the full news experience with this symbol pre-selected.'
  },
  indexSignalPlaceholder: {
    data: 'Signal ladder placeholder for index pages (full Odin signals live on the Signals page).',
    calculation: 'Rows are shown for layout; counts are not wired to a live signal feed on this screen.',
    example: 'Visit Odin Signals for real-time signal distribution for indices.'
  },
  indexMtdQtd: {
    data: 'Month-to-date and quarter-to-date returns for the index and a comparison symbol.',
    calculation:
      'Computed from daily closes from the start of the current month or quarter through the latest available session.',
    example: 'MTD +2% means price is up about 2% since the month started.'
  },
  indexRelativeStrength: {
    data: 'Compare two indices (or a sector ETF vs the market) across standard return periods.',
    calculation: 'Table and bars show the difference: left choice minus right choice for each period.',
    example: 'Left +3%, right +1% on 1M → difference about +2 points for the left line.'
  },
  keyData52Week: {
    data: '52-week high/low range, average volume, and volatility for this symbol.',
    calculation: 'Based on roughly one year of daily price and volume history ending on the latest data date.',
    example: 'Volatility summarizes how much the stock typically moves day to day, annualized.'
  },
  monthlyReturnsByYear: {
    data: 'Twelve bars for January–December of the year you select, each showing that month’s return.',
    calculation: 'Each bar is total percent change for that calendar month. Months with no data have no bar.',
    example: 'A tall March bar means March had a strong positive month in the chosen year.'
  },
  monthlyReturnsChart: {
    data: 'Monthly return bars for the selected year with a grid scaled in 5% steps.',
    calculation:
      'The vertical scale expands if any month falls outside the default −15% to +25% band so outliers remain visible.',
    example: 'A −8% bar means the stock lost about 8% that month.'
  },
  quarterlyByYear: {
    data: 'Four bars per calendar year (Q1–Q4) showing each quarter’s total return.',
    calculation: 'Each bar is percent change from the quarter’s first to last trading day. Missing quarters have no bar.',
    example: 'Q4 above Q1 means the fourth quarter performed better than the first that year.'
  },
  quarterlyByQuarter: {
    data: 'Bars grouped by quarter (Q1–Q4); colors are different years so you can compare the same quarter across years.',
    calculation: 'Uses the same quarterly returns as the left chart, reorganized. The Y-axis matches the left panel.',
    example: 'Compare all Q1 bars to see which years had the strongest first quarters.'
  },
  monthlyWaterfall: {
    data: 'Month-by-month bridge for one calendar year: how each month added to the running total.',
    calculation:
      'Blue months are gains, orange are losses, grey is flat. Labels on bars are that month’s return, not the cumulative level.',
    example: 'After a +2% January and −1% February, the bridge steps down slightly into March.'
  },
  monthlyWinLossDonut: {
    data: 'For the same year as the waterfall: how many months finished up vs down.',
    calculation: 'Counts months with positive return vs negative. Months at exactly 0% are excluded from both slices.',
    example: 'Eight up months and four down months → roughly two-thirds winning months.'
  }
};

/** @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode */
function periodNoun(periodMode) {
  if (periodMode === 'quarterly') return { singular: 'quarter', plural: 'quarters', title: 'Quarterly' };
  if (periodMode === 'monthly') return { singular: 'month', plural: 'months', title: 'Monthly' };
  if (periodMode === 'weekly') return { singular: 'week', plural: 'weeks', title: 'Weekly' };
  if (periodMode === 'daily') return { singular: 'day', plural: 'days', title: 'Daily' };
  return { singular: 'year', plural: 'years', title: 'Annual' };
}

/** @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode */
export function getReturnMagnitudeTotalTip(periodMode) {
  const pn = periodNoun(periodMode);
  return {
    data: `Counts every ${pn.singular} in your range by how large the move was (small vs big), regardless of up or down.`,
    calculation:
      'Buckets use the size of the move: 0–1%, 1–2.5%, 2.5–5%, 5–10%, and over 10%. Gains and losses share the same size buckets.',
    example: `Many bars in the 0–1% bucket means the stock often had only small moves each ${pn.singular}.`
  };
}

/**
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode
 * @param {'positive'|'negative'} mode
 */
export function getReturnMagnitudeSideTip(periodMode, mode) {
  const pn = periodNoun(periodMode);
  const up = mode === 'positive';
  return {
    data: up
      ? `Only ${pn.plural} with a gain, grouped by how strong the positive return was.`
      : `Only ${pn.plural} with a loss, grouped by how deep the negative return was.`,
    calculation: up
      ? 'Each winning period is placed in a size bucket based on its actual positive percent return.'
      : 'Each losing period is placed in a size bucket based on how negative the return was.',
    example: up
      ? `If five ${pn.plural} gained between 2.5% and 5%, that bucket shows a count of five.`
      : `If two ${pn.plural} lost more than 10%, they appear in the largest loss bucket.`
  };
}

/**
 * @param {{ isSector: boolean, sectorLabel?: string }} opts
 * @returns {ChartInfoTipContent}
 */
export function getIndexConstituentsTip({ isSector, sectorLabel }) {
  if (isSector && sectorLabel) {
    return {
      data: `S&P 500 stocks in the ${sectorLabel} sector with last price and today’s return (%).`,
      calculation:
        'The list matches the same sector grouping used on the sector heatmap. Only names in that sector appear.',
      example: 'A stock at +1.4% was up about 1.4% on the latest trading day.'
    };
  }
  return {
    data: 'Index members with last price and today’s return (%).',
    calculation: 'All constituents in the selected index as of the latest market snapshot.',
    example: 'Sort by Return % to see today’s biggest movers in the index.'
  };
}
