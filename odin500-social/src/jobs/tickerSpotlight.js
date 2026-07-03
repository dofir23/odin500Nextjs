const { config } = require('../config');
const { getOhlcPreview } = require('../api/odinClient');
const { finalizeSocialPost } = require('./postHelpers');
const {
  contentId,
  buildTrackedUrl,
  resolvePath,
  formatPct,
  formatPrice,
  etDateLabel
} = require('../utils/utm');

function pickRotationSymbol() {
  const list = config.watchlist.rotation || ['AAPL'];
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return list[day % list.length];
}

async function runTickerSpotlight(symbol) {
  const sym = String(symbol || pickRotationSymbol()).toUpperCase();
  const ohlc = await getOhlcPreview(sym, 120);
  const rows = ohlc.rows || [];
  if (rows.length < 2) throw new Error(`Insufficient OHLC for ${sym}`);

  const first = rows[rows.length - 1];
  const last = rows[0];
  const chg = ((Number(last.close) - Number(first.close)) / Number(first.close)) * 100;

  const id = contentId('ticker_spotlight', sym);
  const pagePath = resolvePath('ticker_spotlight', { symbol: sym });
  const link = buildTrackedUrl({ campaign: 'ticker_spotlight', path: pagePath, content: id });
  const tags = (config.hashtags.default || []).concat(`#${sym}`).join(' ');

  const hook = `$${sym} spotlight — ${ohlc.company_name || 'U.S. equity'}`;
  const bullets = [
    `Latest close ${formatPrice(ohlc.latest_close)} (${ohlc.latest_date})`,
    `Period change ~${formatPct(chg)}`
  ];

  return finalizeSocialPost({
    id,
    pillar: 'ticker_spotlight',
    campaign: 'ticker_spotlight',
    data: { symbol: sym, companyName: ohlc.company_name, changePct: chg },
    links: { default: link, twitter: link, linkedin: link },
    snapshot: {
      pagePath,
      selector: '.ticker-chart-body--main',
      fallbackSelector: '.ticker-chart-plot-host'
    },
    chartFallback: {
      chart: {
        symbol: ohlc.symbol,
        companyName: ohlc.company_name,
        rows,
        subtitle: `~${rows.length} trading days · Odin500`
      }
    },
    copyInput: {
      campaign: 'ticker_spotlight',
      hook,
      bullets,
      link,
      tags,
      context: {
        symbol: sym,
        companyName: ohlc.company_name,
        latestClose: ohlc.latest_close,
        latestDate: ohlc.latest_date,
        changePct: chg,
        date: etDateLabel()
      }
    }
  });
}

module.exports = { runTickerSpotlight, pickRotationSymbol };
