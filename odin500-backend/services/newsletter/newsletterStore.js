const bigquery = require('../../config/bigquery');
const { NEWSLETTER_TABLE_FQN } = require('./newsletterConfig');
const { invalidateNewsletterCache } = require('./newsletterCache');

let tablesReady = false;

function rowDateKey(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.value) return String(v.value).slice(0, 10);
  return String(v).slice(0, 10);
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToIssue(row, { includeBody = true } = {}) {
  if (!row) return null;
  const issue = {
    slug: String(row.slug || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    publishedAt: rowDateKey(row.published_at),
    weekLabel: row.week_label ? String(row.week_label) : undefined,
    weekStart: rowDateKey(row.week_start),
    weekEnd: rowDateKey(row.week_end),
    tags: parseTags(row.tags_json),
    author: String(row.author || 'Odin500'),
    generator: row.generator ? String(row.generator) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined
  };
  if (includeBody) {
    issue.bodyMarkdown = String(row.body_markdown || '');
  }
  return issue;
}

async function ensureTables() {
  if (tablesReady) return;
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${NEWSLETTER_TABLE_FQN} (
      slug STRING NOT NULL,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      published_at DATE NOT NULL,
      week_label STRING NOT NULL,
      title STRING NOT NULL,
      description STRING NOT NULL,
      body_markdown STRING NOT NULL,
      tags_json STRING,
      author STRING,
      generator STRING,
      market_context_json STRING,
      created_at TIMESTAMP NOT NULL
    )
    CLUSTER BY published_at, slug
  `;
  await bigquery.query({ query: ddl });
  tablesReady = true;
}

async function listNewsletterSummaries(limit = 104) {
  await ensureTables();
  const query = `
    SELECT slug, week_start, week_end, published_at, week_label, title, description,
           tags_json, author, generator, created_at
    FROM ${NEWSLETTER_TABLE_FQN}
    ORDER BY published_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({ query, params: { limit: Number(limit) } });
  return (rows || []).map((row) => rowToIssue(row, { includeBody: false })).filter(Boolean);
}

async function listNewsletterSlugs(limit = 104) {
  await ensureTables();
  const query = `
    SELECT slug
    FROM ${NEWSLETTER_TABLE_FQN}
    ORDER BY published_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({ query, params: { limit: Number(limit) } });
  return (rows || []).map((row) => String(row.slug || '')).filter(Boolean);
}

async function listNewsletters(limit = 104) {
  await ensureTables();
  const query = `
    SELECT slug, week_start, week_end, published_at, week_label, title, description,
           body_markdown, tags_json, author, generator, created_at
    FROM ${NEWSLETTER_TABLE_FQN}
    ORDER BY published_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({ query, params: { limit: Number(limit) } });
  return (rows || []).map((row) => rowToIssue(row, { includeBody: true })).filter(Boolean);
}

async function getNewsletterBySlug(slug) {
  await ensureTables();
  const query = `
    SELECT slug, week_start, week_end, published_at, week_label, title, description,
           body_markdown, tags_json, author, generator, created_at
    FROM ${NEWSLETTER_TABLE_FQN}
    WHERE slug = @slug
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { slug: String(slug) } });
  return rowToIssue(rows?.[0], { includeBody: true }) || null;
}

async function slugExists(slug) {
  await ensureTables();
  const query = `
    SELECT slug
    FROM ${NEWSLETTER_TABLE_FQN}
    WHERE slug = @slug
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { slug: String(slug) } });
  return Boolean(rows?.[0]);
}

async function insertNewsletter(issue) {
  await ensureTables();
  const query = `
    INSERT INTO ${NEWSLETTER_TABLE_FQN} (
      slug, week_start, week_end, published_at, week_label, title, description,
      body_markdown, tags_json, author, generator, market_context_json, created_at
    ) VALUES (
      @slug, DATE(@weekStart), DATE(@weekEnd), DATE(@publishedAt), @weekLabel,
      @title, @description, @bodyMarkdown, @tagsJson, @author, @generator,
      @marketContextJson, CURRENT_TIMESTAMP()
    )
  `;
  await bigquery.query({
    query,
    params: {
      slug: issue.slug,
      weekStart: issue.weekStart,
      weekEnd: issue.weekEnd,
      publishedAt: issue.publishedAt,
      weekLabel: issue.weekLabel,
      title: issue.title,
      description: issue.description,
      bodyMarkdown: issue.bodyMarkdown,
      tagsJson: JSON.stringify(issue.tags || []),
      author: issue.author || 'Odin500',
      generator: issue.generator || 'template',
      marketContextJson: issue.marketContextJson || ''
    }
  });
  await invalidateNewsletterCache();
}

async function deleteNewsletterBySlug(slug) {
  await ensureTables();
  await bigquery.query({
    query: `DELETE FROM ${NEWSLETTER_TABLE_FQN} WHERE slug = @slug`,
    params: { slug: String(slug) }
  });
  await invalidateNewsletterCache();
}

async function upsertNewsletter(issue) {
  await deleteNewsletterBySlug(issue.slug);
  await insertNewsletter(issue);
}

module.exports = {
  ensureTables,
  listNewsletters,
  listNewsletterSummaries,
  listNewsletterSlugs,
  getNewsletterBySlug,
  slugExists,
  insertNewsletter,
  deleteNewsletterBySlug,
  upsertNewsletter,
  rowToIssue
};
