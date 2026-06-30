#!/usr/bin/env node
/**
 * Fix newsletter descriptions stored as YAML block markers (e.g. `>-`) in BigQuery.
 * Usage: node scripts/fix-newsletter-descriptions-bq.js
 */
require('dotenv').config();
const bigquery = require('../config/bigquery');
const { NEWSLETTER_TABLE_FQN } = require('../services/newsletter/newsletterConfig');
const { normalizeNewsletterDescription } = require('../services/newsletter/newsletterText');

const FALLBACK =
  'Weekly U.S. equity market recap from Odin500 index, sector, and signal data.';

async function main() {
  const [rows] = await bigquery.query({
    query: `SELECT slug, description, body_markdown FROM ${NEWSLETTER_TABLE_FQN}`
  });

  let fixed = 0;
  for (const row of rows || []) {
    const slug = String(row.slug || '');
    const current = String(row.description || '').trim();
    const normalized = normalizeNewsletterDescription(current, '');
    if (normalized && normalized !== current) {
      await bigquery.query({
        query: `UPDATE ${NEWSLETTER_TABLE_FQN} SET description = @description WHERE slug = @slug`,
        params: { slug, description: normalized }
      });
      console.log('fixed', slug);
      fixed += 1;
      continue;
    }
    if (!normalized && row.body_markdown) {
      const firstPara = String(row.body_markdown)
        .replace(/^#.+$/m, '')
        .split('\n\n')
        .map((s) => s.trim())
        .find((s) => s && !s.startsWith('#'));
      const excerpt = firstPara
        ? firstPara.replace(/\*\*/g, '').slice(0, 220).trim()
        : FALLBACK;
      await bigquery.query({
        query: `UPDATE ${NEWSLETTER_TABLE_FQN} SET description = @description WHERE slug = @slug`,
        params: { slug, description: excerpt }
      });
      console.log('fixed from body', slug);
      fixed += 1;
    }
  }
  console.log(`Done. fixed=${fixed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
