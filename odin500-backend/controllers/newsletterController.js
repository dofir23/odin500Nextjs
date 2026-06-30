const {
  listNewsletterSummaries,
  listNewsletterSlugs,
  getNewsletterBySlug
} = require('../services/newsletter/newsletterStore');
const { generateWeeklyNewsletter } = require('../services/newsletter/generateWeeklyNewsletter');
const { cached, setPublicCacheHeaders } = require('../services/newsletter/newsletterCache');

function toPublicSummary(issue) {
  if (!issue) return null;
  return {
    slug: issue.slug,
    title: issue.title,
    description: issue.description,
    publishedAt: issue.publishedAt,
    weekLabel: issue.weekLabel,
    tags: issue.tags,
    author: issue.author,
    generator: issue.generator
  };
}

function toPublicIssue(issue) {
  if (!issue) return null;
  return {
    ...toPublicSummary(issue),
    bodyMarkdown: issue.bodyMarkdown
  };
}

async function listPublicNewsletters(req, res) {
  try {
    setPublicCacheHeaders(res);
    const issues = await cached('list:summaries', () => listNewsletterSummaries());
    return res.json({ success: true, issues: issues.map(toPublicSummary) });
  } catch (err) {
    console.error('[newsletter] list failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load newsletters' });
  }
}

async function listPublicNewsletterSlugs(req, res) {
  try {
    setPublicCacheHeaders(res);
    const slugs = await cached('list:slugs', () => listNewsletterSlugs());
    return res.json({ success: true, slugs });
  } catch (err) {
    console.error('[newsletter] slugs failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load newsletter slugs' });
  }
}

async function getPublicNewsletterBySlug(req, res) {
  const slug = String(req.params.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ success: false, error: 'Missing slug' });
  }
  try {
    setPublicCacheHeaders(res);
    const issue = await cached(`slug:${slug}`, () => getNewsletterBySlug(slug));
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Newsletter not found' });
    }
    return res.json({ success: true, issue: toPublicIssue(issue) });
  } catch (err) {
    console.error('[newsletter] get failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load newsletter' });
  }
}

async function adminGenerateNewsletter(req, res) {
  const secret = process.env.NEWSLETTER_ADMIN_SECRET?.trim();
  if (secret) {
    const provided = String(req.headers['x-newsletter-admin-secret'] || req.body?.secret || '');
    if (provided !== secret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  const week = req.body?.week || req.query?.week;
  const force = req.body?.force === true || req.query?.force === 'true' || req.query?.force === '1';

  try {
    const result = await generateWeeklyNewsletter({
      weekSunday: week ? String(week).slice(0, 10) : undefined,
      force
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[newsletter] generate failed:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Generation failed' });
  }
}

module.exports = {
  listPublicNewsletters,
  listPublicNewsletterSlugs,
  getPublicNewsletterBySlug,
  adminGenerateNewsletter
};
