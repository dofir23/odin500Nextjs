const { runDailyPulse } = require('./dailyPulse');
const { runTickerSpotlight } = require('./tickerSpotlight');
const { runWeeklyNewsletter } = require('./weeklyNewsletter');
const { runChartPost } = require('./chartPost');

const JOBS = {
  'daily-pulse': runDailyPulse,
  'ticker-spotlight': runTickerSpotlight,
  'weekly-newsletter': runWeeklyNewsletter,
  'chart-post': runChartPost
};

async function runJob(name, opts = {}) {
  const fn = JOBS[name];
  if (!fn) {
    const err = new Error(`Unknown job: ${name}. Available: ${Object.keys(JOBS).join(', ')}`);
    err.status = 404;
    throw err;
  }
  if (name === 'ticker-spotlight') {
    return runTickerSpotlight(opts.symbol);
  }
  if (name === 'chart-post') {
    return runChartPost(opts);
  }
  return fn();
}

module.exports = { JOBS, runJob };
