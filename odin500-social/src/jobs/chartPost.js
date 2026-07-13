const { config } = require('../config');
const { resolveChart } = require('../charts/chartCatalog');
const { fetchChartContext } = require('../charts/fetchChartContext');
const { finalizeSocialPost } = require('./postHelpers');
const { contentId, buildTrackedUrl } = require('../utils/utm');

/**
 * @param {{ chartId?: string, symbol?: string }} opts
 */
async function runChartPost(opts = {}) {
  const chartId = opts.chartId || opts.chart;
  if (!chartId) {
    const err = new Error('chartId is required');
    err.status = 400;
    throw err;
  }

  const resolved = resolveChart(chartId, { symbol: opts.symbol });
  const metrics = await fetchChartContext(resolved.contextKind, {
    symbol: resolved.symbol,
    chartLabel: resolved.label
  });

  const id = contentId(
    'chart_post',
    resolved.symbol || resolved.chartId.replace(/-/g, '_')
  );
  const link = buildTrackedUrl({
    campaign: resolved.campaign,
    path: resolved.pagePath,
    content: id
  });
  const tags = (config.hashtags.default || [])
    .concat(resolved.symbol ? `#${resolved.symbol}` : [])
    .join(' ');

  return finalizeSocialPost({
    id,
    pillar: 'chart_post',
    campaign: 'chart_post',
    data: {
      ...(metrics.data || {}),
      chartId: resolved.chartId,
      chartLabel: resolved.label,
      symbol: resolved.symbol
    },
    links: { default: link, twitter: link, linkedin: link },
    snapshot: {
      pagePath: resolved.pagePath,
      selector: resolved.selector,
      fallbackSelector: resolved.fallbackSelector
    },
    chartFallback: metrics.chartFallback || undefined,
    copyInput: {
      campaign: 'chart_post',
      hook: metrics.hook,
      bullets: metrics.bullets,
      link,
      tags,
      context: {
        ...(metrics.context || {}),
        chartId: resolved.chartId,
        chartLabel: resolved.label,
        pagePath: resolved.pagePath
      }
    },
    extraMeta: {
      chartId: resolved.chartId,
      chartLabel: resolved.label
    }
  });
}

module.exports = { runChartPost };
