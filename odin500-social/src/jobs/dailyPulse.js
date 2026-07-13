const { config } = require('../config');
const { getOhlcPreview, getTickerReturnsBatch } = require('../api/odinClient');
const { finalizeSocialPost } = require('./postHelpers');
const {
  contentId,
  buildTrackedUrl,
  resolvePath,
  formatPct,
  formatPrice,
  etDateLabel
} = require('../utils/utm');

function pickReturn(perf, label) {
  if (!perf || typeof perf !== 'object') return null;
  const row = perf[label];
  if (row == null) return null;
  if (typeof row === 'number') return row;
  if (typeof row === 'object' && row.return != null) return Number(row.return);
  return null;
}

async function runDailyPulse() {
  const indices = config.watchlist.indices || ['SPY', 'QQQ', 'DIA'];
  let bullets = [];
  let chartSymbol = 'SPY';

  const batch = await getTickerReturnsBatch(indices).catch(() => null);
  if (batch?.byTicker) {
    for (const sym of indices) {
      const row = batch.byTicker[sym];
      const perf = row?.data?.performance || row?.performance;
      const ytd = pickReturn(perf, 'Year to Date (YTD)');
      const m1 = pickReturn(perf, 'Last Month');
      if (ytd != null) bullets.push(`${sym} YTD ${formatPct(ytd)}`);
      if (m1 != null && bullets.length < 4) bullets.push(`${sym} 1M ${formatPct(m1)}`);
    }
  }

  if (!bullets.length) {
    const preview = await getOhlcPreview('SPY', 60);
    chartSymbol = preview.symbol;
    const rows = preview.rows || [];
    const newest = rows[0];
    const oldest = rows[rows.length - 1];
    if (newest && oldest) {
      const chg = ((Number(newest.close) - Number(oldest.close)) / Number(oldest.close)) * 100;
      bullets.push(`SPY ${rows.length}d change ${formatPct(chg)}`);
      bullets.push(`Latest close ${formatPrice(preview.latest_close)}`);
    }
  } else {
    const preview = await getOhlcPreview(chartSymbol, 60);
    if (preview?.rows?.length) chartSymbol = preview.symbol;
  }

  const ohlc = await getOhlcPreview(chartSymbol, 90);
  const id = contentId('daily_pulse');
  const pagePath = resolvePath('daily_pulse');
  const link = buildTrackedUrl({ campaign: 'daily_pulse', path: pagePath, content: id });
  const tags = (config.hashtags.default || []).join(' ');
  const hook = `U.S. markets at the close — ${etDateLabel()}.`;

  return finalizeSocialPost({
    id,
    pillar: 'market_pulse',
    campaign: 'daily_pulse',
    data: { indices, bullets, chartSymbol },
    links: { default: link, twitter: link, linkedin: link },
    snapshot: {
      pagePath: '/market',
      selector: '.mkt-center > .np-card',
      fallbackSelector: '.np-card'
    },
    chartFallback: {
      chart: {
        symbol: ohlc.symbol,
        companyName: ohlc.company_name,
        rows: ohlc.rows,
        subtitle: `U.S. equity pulse · ${etDateLabel()}`
      }
    },
    copyInput: {
      campaign: 'daily_pulse',
      hook,
      bullets,
      link,
      tags,
      context: { indices, chartSymbol, date: etDateLabel() }
    }
  });
}

module.exports = { runDailyPulse };
