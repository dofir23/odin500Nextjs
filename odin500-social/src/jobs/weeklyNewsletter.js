const { listNewsletters } = require('../api/odinClient');
const { finalizeSocialPost } = require('./postHelpers');
const { contentId, buildTrackedUrl, resolvePath, etDateLabel } = require('../utils/utm');
const { config } = require('../config');

async function runWeeklyNewsletter() {
  const data = await listNewsletters();
  const issues = data?.issues || [];
  if (!issues.length) throw new Error('No newsletter issues from API');

  const latest = issues[0];
  const slug = latest.slug || latest.meta?.slug;
  const title = latest.title || latest.meta?.title || 'Weekly market recap';
  const weekLabel = latest.weekLabel || latest.meta?.weekLabel || '';
  const description = latest.description || latest.meta?.description || '';

  const id = contentId('newsletter', slug);
  const pagePath = resolvePath('newsletter', { slug });
  const link = buildTrackedUrl({ campaign: 'newsletter', path: pagePath, content: id });
  const tags = (config.hashtags.newsletter || config.hashtags.default || []).join(' ');

  const hook = weekLabel
    ? `Odin500 Weekly — ${weekLabel}`
    : `New Odin500 Weekly recap (${etDateLabel()})`;

  const bullets = [
    title,
    description ? description.slice(0, 220) : 'Indices, sectors, signals, and setups.'
  ].filter(Boolean);

  return finalizeSocialPost({
    id,
    pillar: 'newsletter',
    campaign: 'newsletter',
    data: { slug, title, weekLabel },
    links: { default: link, twitter: link, linkedin: link },
    snapshot: {
      pagePath,
      selector: '.newsletter-page',
      fallbackSelector: 'main#app-main-content'
    },
    copyInput: {
      campaign: 'newsletter',
      hook,
      bullets,
      link,
      tags,
      context: { slug, title, weekLabel, description }
    }
  });
}

module.exports = { runWeeklyNewsletter };
