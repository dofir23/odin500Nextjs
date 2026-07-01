const { runDailyPulse } = require('./dailyPulse');
const { runTickerSpotlight } = require('./tickerSpotlight');
const { runWeeklyNewsletter } = require('./weeklyNewsletter');

const JOBS = {
  'daily-pulse': runDailyPulse,
  'ticker-spotlight': runTickerSpotlight,
  'weekly-newsletter': runWeeklyNewsletter
};

async function runJob(name, opts = {}) {
  const fn = JOBS[name];
  if (!fn) {
    const err = new Error(`Unknown job: ${name}. Available: ${Object.keys(JOBS).join(', ')}`);
    err.status = 404;
    throw err;
  }
  if (name === 'ticker-spotlight' && opts.symbol) {
    return runTickerSpotlight(opts.symbol);
  }
  return fn();
}

module.exports = { JOBS, runJob };
