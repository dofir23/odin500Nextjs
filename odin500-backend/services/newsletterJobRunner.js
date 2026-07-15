const cron = require('node-cron');
const { runWeeklyNewsletterJob } = require('../jobs/weeklyNewsletterJob');

const ENABLE = process.env.ENABLE_WEEKLY_NEWSLETTER_JOB === '1';
/** Cron: Sunday 12:00 UTC — Mon–Sun week ending that Sunday */
const CRON_EXPR = process.env.WEEKLY_NEWSLETTER_CRON || '0 12 * * 0';

let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const result = await runWeeklyNewsletterJob();
    if (result.skipped) {
      console.log(`[weekly-newsletter] skip slug=${result.slug} (already exists)`);
    } else {
      console.log(
        `[weekly-newsletter] created slug=${result.slug} generator=${result.generator} in ${Date.now() - started}ms`
      );
    }
  } catch (err) {
    console.error('[weekly-newsletter] failed:', err?.message || err);
  } finally {
    running = false;
  }
}

function startNewsletterJobRunner() {
  if (!ENABLE) {
    console.log('[weekly-newsletter] disabled (set ENABLE_WEEKLY_NEWSLETTER_JOB=1 to enable; default is off to reduce BigQuery cost)');
    return;
  }
  if (!cron.validate(CRON_EXPR)) {
    console.warn('[weekly-newsletter] invalid cron, not started:', CRON_EXPR);
    return;
  }
  cron.schedule(CRON_EXPR, () => {
    void runOnce();
  });
  console.log(`[weekly-newsletter] scheduled (${CRON_EXPR} UTC)`);
}

module.exports = { startNewsletterJobRunner, runWeeklyNewsletterOnce: runOnce };
