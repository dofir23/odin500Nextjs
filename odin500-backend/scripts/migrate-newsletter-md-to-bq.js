#!/usr/bin/env node
/**
 * One-off: import legacy markdown issues from odin500-frontend into BigQuery.
 * Usage: node scripts/migrate-newsletter-md-to-bq.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { upsertNewsletter, getNewsletterBySlug } = require('../services/newsletter/newsletterStore');

function parseMarkdownFile(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const fm = match[1];
  const content = match[2].trim();
  const data = parseYamlFrontmatter(fm);
  return { data, content };
}

function parseYamlFrontmatter(fm) {
  const data = {};
  const lines = fm.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const block = line.match(/^(\w+):\s*(>|>-|>\+|\|-?|\+)?\s*$/);
    if (block) {
      const key = block[1];
      const style = block[2] || '';
      i += 1;
      const blockLines = [];
      while (i < lines.length && /^\s+/.test(lines[i])) {
        blockLines.push(lines[i].replace(/^\s+/, ''));
        i += 1;
      }
      const joined = blockLines.join(style.startsWith('>') ? ' ' : '\n').trim();
      if (key !== 'tags') data[key] = joined;
      continue;
    }

    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key !== 'tags') data[key] = val;
    }
    i += 1;
  }

  const tagsBlock = fm.match(/tags:\s*\n((?:\s+-\s+.+\n?)+)/);
  if (tagsBlock) {
    data.tags = tagsBlock[1]
      .split('\n')
      .map((l) => l.replace(/^\s*-\s+/, '').trim())
      .filter(Boolean);
  }

  return data;
}

const FRONTEND_NEWSLETTER_DIR = path.resolve(
  __dirname,
  '../../odin500-frontend/src/content/newsletter'
);

function addDays(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

async function main() {
  if (!fs.existsSync(FRONTEND_NEWSLETTER_DIR)) {
    console.error('Newsletter dir not found:', FRONTEND_NEWSLETTER_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(FRONTEND_NEWSLETTER_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const existing = await getNewsletterBySlug(slug);
    if (existing) {
      console.log('skip', slug, '(already in BigQuery)');
      skipped += 1;
      continue;
    }

    const raw = fs.readFileSync(path.join(FRONTEND_NEWSLETTER_DIR, file), 'utf8');
    const parsed = parseMarkdownFile(raw);
    if (!parsed) {
      console.warn('skip invalid', file);
      skipped += 1;
      continue;
    }
    const { data, content } = parsed;
    const publishedAt = String(data.publishedAt || '').slice(0, 10);
    if (!publishedAt || !data.title) {
      console.warn('skip invalid', file);
      skipped += 1;
      continue;
    }

    const weekEnd = publishedAt;
    const weekStart = addDays(weekEnd, -6);

    await upsertNewsletter({
      slug,
      weekStart,
      weekEnd,
      publishedAt,
      weekLabel: String(data.weekLabel || publishedAt),
      title: String(data.title),
      description: String(data.description || ''),
      bodyMarkdown: content.trim(),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      author: String(data.author || 'Odin500'),
      generator: data.generator ? String(data.generator) : 'imported-md'
    });
    console.log('imported', slug);
    imported += 1;
  }

  console.log(`Done. imported=${imported} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
