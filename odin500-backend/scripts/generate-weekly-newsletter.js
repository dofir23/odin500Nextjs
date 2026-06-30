#!/usr/bin/env node
/**
 * Generate weekly newsletter into BigQuery.
 *   node scripts/generate-weekly-newsletter.js
 *   node scripts/generate-weekly-newsletter.js --week 2026-06-28 --force
 */
require('dotenv').config();
const { generateWeeklyNewsletter } = require('../services/newsletter/generateWeeklyNewsletter');

function parseArgs(argv) {
  const out = { week: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') out.force = true;
    else if (a === '--week' && argv[i + 1]) {
      out.week = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main() {
  const { week, force } = parseArgs(process.argv.slice(2));
  const key = process.env.OPENAI_API_KEY?.trim();
  console.log(`[newsletter] OPENAI_API_KEY: ${key ? 'set' : 'NOT SET'}`);

  const result = await generateWeeklyNewsletter({
    weekSunday: week || undefined,
    force
  });

  if (result.skipped) {
    console.log(`[newsletter] skipped (exists): ${result.slug}`);
  } else {
    console.log(`[newsletter] created: ${result.slug} (${result.generator})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
