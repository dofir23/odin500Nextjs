const { getCompletedWeek, getWeekEndingSunday } = require('./newsletterWeek');
const { fetchNewsletterContext } = require('./newsletterContext');
const { generateNewsletterContent } = require('./newsletterAi');
const { slugExists, insertNewsletter, upsertNewsletter } = require('./newsletterStore');
const { notifyNewsletterSubscribers } = require('./notifyNewsletterSubscribers');

/**
 * @param {{ weekSunday?: string, force?: boolean }} opts
 */
async function generateWeeklyNewsletter(opts = {}) {
  const week = opts.weekSunday
    ? getWeekEndingSunday(opts.weekSunday)
    : getCompletedWeek();

  const exists = await slugExists(week.slug);
  if (exists && !opts.force) {
    return { skipped: true, slug: week.slug, weekLabel: week.weekLabel };
  }

  const ctx = await fetchNewsletterContext();
  if (!ctx) throw new Error('Market context unavailable');

  const { content, source } = await generateNewsletterContent(week, ctx);

  const issue = {
    slug: week.slug,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    publishedAt: week.publishedAt,
    weekLabel: week.weekLabel,
    title: content.title,
    description: content.description,
    bodyMarkdown: content.body,
    tags: content.tags,
    author: 'Odin500',
    generator: source,
    marketContextJson: JSON.stringify(ctx)
  };

  if (exists && opts.force) {
    await upsertNewsletter(issue);
  } else {
    await insertNewsletter(issue);
  }

  const result = {
    skipped: false,
    slug: week.slug,
    weekLabel: week.weekLabel,
    generator: source,
    title: content.title,
    description: content.description
  };

  try {
    const stats = await notifyNewsletterSubscribers(result);
    console.log(
      `[newsletter] notified subscribers=${stats.subscribers} inApp=${stats.inApp} emails=${stats.emails}`
    );
  } catch (err) {
    console.warn('[newsletter] subscriber notify failed:', err?.message || err);
  }

  return result;
}

module.exports = { generateWeeklyNewsletter };
