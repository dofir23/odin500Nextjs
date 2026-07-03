const { config } = require('../config');
const { createPostDraft } = require('../queue/store');
const { notifyPostGenerated } = require('../publish/webhook');
const { generateSocialCopy } = require('../ai/generateSocialCopy');
const { capturePageSnapshot } = require('../render/pageSnapshot');
const { renderOhlcChart } = require('../render/chartImage');
const { log } = require('../utils/log');

/**
 * @param {object} opts
 */
async function resolvePostImage({ id, snapshot, chartFallback }) {
  if (snapshot?.pagePath) {
    try {
      return await capturePageSnapshot({
        pagePath: snapshot.pagePath,
        selector: snapshot.selector,
        fallbackSelector: snapshot.fallbackSelector,
        outBasename: id
      });
    } catch (err) {
      log.warn('post', `Page snapshot failed: ${err?.message || err}`);
    }
  }

  if (chartFallback) {
    log.info('post', 'Using QuickChart fallback image');
    const asset = await renderOhlcChart(chartFallback.chart, id);
    return { ...asset, source: 'quickchart_fallback' };
  }

  return null;
}

/**
 * @param {object} opts
 */
async function finalizeSocialPost(opts) {
  const {
    id,
    pillar,
    campaign,
    data,
    links,
    copyInput,
    snapshot,
    chartFallback,
    extraMeta = {}
  } = opts;

  log.info('post', `Building draft ${id} (${campaign})`);

  const [asset, aiResult] = await Promise.all([
    resolvePostImage({ id, snapshot, chartFallback }),
    generateSocialCopy(copyInput)
  ]);

  const post = createPostDraft({
    id,
    pillar,
    campaign,
    data,
    assets: asset
      ? { image: asset.filename, imagePath: asset.filePath, pageUrl: asset.pageUrl }
      : {},
    links,
    copy: aiResult.copy,
    meta: {
      copySource: aiResult.source,
      copyFallbackReason: aiResult.reason,
      aiModel: aiResult.model,
      imageSource: asset?.source || 'none',
      openaiConfigured: Boolean(config.openaiApiKey),
      ...extraMeta
    }
  });

  log.info('post', `Draft ready ${id}`, {
    copySource: post.meta.copySource,
    imageSource: post.meta.imageSource,
    aiModel: post.meta.aiModel
  });

  await notifyPostGenerated(post);
  return post;
}

module.exports = { finalizeSocialPost, resolvePostImage };
