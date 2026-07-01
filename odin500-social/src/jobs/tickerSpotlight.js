const { config } = require('../config');
const { getOhlcPreview } = require('../api/odinClient');
const { renderOhlcChart } = require('../render/chartImage');
const { createPostDraft } = require('../queue/store');
const { notifyPostGenerated } = require('../publish/webhook');
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
  const asset = await renderOhlcChart(
    {
      symbol: ohlc.symbol,
      companyName: ohlc.company_name,
      rows,
      subtitle: `~${rows.length} trading days · Odin500`
    },
    id
  );

  const pagePath = resolvePath('ticker_spotlight', { symbol: sym });
  const link = buildTrackedUrl({ campaign: 'ticker_spotlight', path: pagePath, content: id });
  const tags = (config.hashtags.default || []).concat(`#${sym}`).join(' ');

  const hook = `$${sym} spotlight — ${ohlc.company_name || 'U.S. equity'}`;
  const bullets = [
    `Latest close ${formatPrice(ohlc.latest_close)} (${ohlc.latest_date})`,
    `Period change ~${formatPct(chg)}`
  ];

  const post = createPostDraft({
    id,
    pillar: 'ticker_spotlight',
    campaign: 'ticker_spotlight',
    data: { symbol: sym, companyName: ohlc.company_name, changePct: chg },
    assets: { image: asset.filename, imagePath: asset.filePath },
    links: { default: link, twitter: link, linkedin: link },
    copy: {
      twitter: `${hook}\n\n${bullets.map((b) => `• ${b}`).join('\n')}\n\n${config.disclaimer}\n\n→ ${link}\n\n${tags}`,
      linkedin: `${hook}\n\n${bullets.join('\n')}\n\nFull OHLC chart, signals, and return analytics on Odin500.\n\n${config.disclaimer}\n\n${link}`
    }
  });

  await notifyPostGenerated(post);
  return post;
}

module.exports = { runTickerSpotlight, pickRotationSymbol };
