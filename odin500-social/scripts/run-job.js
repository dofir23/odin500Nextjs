#!/usr/bin/env node
require('dotenv').config();
const { ensureDirs } = require('../src/config');
const { runJob } = require('../src/jobs');

async function main() {
  const name = process.argv[2];
  const arg2 = process.argv[3];
  const arg3 = process.argv[4];
  if (!name) {
    console.error(
      'Usage: node scripts/run-job.js <daily-pulse|ticker-spotlight|weekly-newsletter|chart-post> [SYMBOL|CHART_ID] [SYMBOL]'
    );
    process.exit(1);
  }
  ensureDirs();
  let opts = {};
  if (name === 'chart-post') {
    opts = { chartId: arg2, symbol: arg3 };
  } else if (arg2) {
    opts = { symbol: arg2 };
  }
  const post = await runJob(name, opts);
  console.log(JSON.stringify(post, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
