const cron = require('node-cron');
const { config } = require('./config');
const { runJob } = require('./jobs');

function safeCron(expr, handler, label) {
  if (!cron.validate(expr)) {
    console.warn(`[cron] invalid expression for ${label}: ${expr}`);
    return null;
  }
  return cron.schedule(
    expr,
    () => {
      handler().catch((err) => console.error(`[cron] ${label} failed:`, err?.message || err));
    },
    { timezone: process.env.TZ || 'America/New_York' }
  );
}

function startScheduler() {
  if (!config.cronEnabled) {
    console.log('[cron] disabled (CRON_ENABLED=false)');
    return;
  }

  safeCron(config.cronDailyPulse, () => runJob('daily-pulse'), 'daily-pulse');
  safeCron(config.cronTickerSpotlight, () => runJob('ticker-spotlight'), 'ticker-spotlight');
  safeCron(config.cronNewsletter, () => runJob('weekly-newsletter'), 'weekly-newsletter');

  console.log('[cron] scheduled:', {
    dailyPulse: config.cronDailyPulse,
    tickerSpotlight: config.cronTickerSpotlight,
    newsletter: config.cronNewsletter,
    tz: process.env.TZ || 'America/New_York'
  });
}

module.exports = { startScheduler };
