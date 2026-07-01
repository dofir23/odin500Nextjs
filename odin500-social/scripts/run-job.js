#!/usr/bin/env node
require('dotenv').config();
const { ensureDirs } = require('../src/config');
const { runJob } = require('../src/jobs');

async function main() {
  const name = process.argv[2];
  const symbol = process.argv[3];
  if (!name) {
    console.error('Usage: node scripts/run-job.js <daily-pulse|ticker-spotlight|weekly-newsletter> [SYMBOL]');
    process.exit(1);
  }
  ensureDirs();
  const post = await runJob(name, symbol ? { symbol } : {});
  console.log(JSON.stringify(post, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
