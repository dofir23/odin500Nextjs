const { listNewsletters } = require('../api/odinClient');
const { createPostDraft } = require('../queue/store');
const { notifyPostGenerated } = require('../publish/webhook');
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

  const dek = description ? description.slice(0, 200) + (description.length > 200 ? '…' : '') : '';

  const post = createPostDraft({
    id,
    pillar: 'newsletter',
    campaign: 'newsletter',
    data: { slug, title, weekLabel },
    assets: {},
    links: { default: link, twitter: link, linkedin: link },
    copy: {
      twitter: `${hook}\n\n${title}${dek ? `\n\n${dek}` : ''}\n\n→ ${link}\n\n${tags}`,
      linkedin: `${hook}\n\n${title}\n\n${dek}\n\nRead the full issue on Odin500 — indices, sectors, signals, and setups.\n\n${link}`
    },
    meta: { note: 'Attach newsletter hero chart manually or extend job with chart render' }
  });

  await notifyPostGenerated(post);
  return post;
}

module.exports = { runWeeklyNewsletter };
