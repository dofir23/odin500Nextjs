const { makeCacheKey, getCache, setCache } = require('../utils/cache');
const { runSplitSync } = require('../jobs/splitSyncJob');
const {
  getSyncState,
  queryRecentSplits,
  querySplits,
  queryLatestPastSplitForTicker,
  queryNextUpcomingSplitForTicker
} = require('../services/splits/stockSplitsStore');
const { getSymbolsForSlug, normalizeIndexSlug } = require('../services/splits/indexUniverse');
const { runPaperSplitAdjustmentJob } = require('../jobs/paperSplitAdjustmentJob');
const {
  getAdjustmentState,
  listRecentPaperAdjustments
} = require('../services/splits/paperSplitAdjuster');
const { validateAdjCloseAroundSplit } = require('../services/splits/adjCloseValidator');

const SPLITS_CACHE_TTL_SECS = Number(process.env.SPLITS_CACHE_TTL_SECS || 300);

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr) {
  const age = daysBetween(dateStr);
  if (age == null) return null;
  return age < 0 ? -age : 0;
}

/** GET /api/splits/recent?days=90&limit=100&index=all|sp500|dow|nasdaq */
async function getRecentSplits(req, res) {
  try {
    const days = Number(req.query.days) || 90;
    const limit = Number(req.query.limit) || 100;
    const index = normalizeIndexSlug(req.query.index);
    const cacheKey = makeCacheKey('splits:recent', { days, limit, index });
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache-Hit', '1');
      return res.status(200).json({ ...cached, cache_hit: true });
    }

    const tickers = await getSymbolsForSlug(index);
    const splits = await queryRecentSplits({ days, limit, tickers });
    const payload = {
      days,
      index,
      universe_size: tickers.length,
      count: splits.length,
      splits,
      cache_hit: false
    };
    await setCache(cacheKey, payload, SPLITS_CACHE_TTL_SECS);
    res.set('X-Cache-Hit', '0');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[splits] recent error:', err);
    res.status(500).json({ error: 'Failed to fetch recent splits' });
  }
}

/** GET /api/splits?ticker=AAPL&from=&to=&limit=&index=all|sp500|dow|nasdaq */
async function getSplits(req, res) {
  try {
    const ticker = req.query.ticker || req.query.symbol || null;
    const from = req.query.from || req.query.start_date || null;
    const to = req.query.to || req.query.end_date || null;
    const limit = Number(req.query.limit) || 200;
    const index = normalizeIndexSlug(req.query.index);
    const cacheKey = makeCacheKey('splits:list', { ticker, from, to, limit, index });
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache-Hit', '1');
      return res.status(200).json({ ...cached, cache_hit: true });
    }

    const tickers = ticker ? null : await getSymbolsForSlug(index);
    const splits = await querySplits({ ticker, from, to, limit, tickers });
    const payload = {
      ticker: ticker ? String(ticker).toUpperCase() : null,
      index,
      universe_size: tickers.length,
      count: splits.length,
      splits,
      cache_hit: false
    };
    await setCache(cacheKey, payload, SPLITS_CACHE_TTL_SECS);
    res.set('X-Cache-Hit', '0');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[splits] list error:', err);
    res.status(500).json({ error: 'Failed to fetch splits' });
  }
}

/** GET /api/splits/ticker/:symbol — latest split + recent flag for banner */
async function getTickerSplitSummary(req, res) {
  try {
    const ticker = String(req.params.symbol || '')
      .trim()
      .toUpperCase();
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    const recentDays = Math.min(Math.max(Number(req.query.recent_days) || 365, 1), 3650);
    const cacheKey = makeCacheKey('splits:ticker-summary', { ticker, recentDays });
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache-Hit', '1');
      return res.status(200).json({ ...cached, cache_hit: true });
    }

    const [latestPast, upcoming] = await Promise.all([
      queryLatestPastSplitForTicker(ticker),
      queryNextUpcomingSplitForTicker(ticker)
    ]);
    const latest = upcoming || latestPast;
    const recent = latestPast ? await queryRecentSplits({ days: recentDays, limit: 5, ticker }) : [];
    const ageDays = latestPast ? daysBetween(latestPast.execution_date) : null;
    const untilDays = upcoming ? daysUntil(upcoming.execution_date) : null;
    const isRecent = ageDays != null && ageDays >= 0 && ageDays <= recentDays;
    const isUpcoming = untilDays != null && untilDays > 0 && untilDays <= recentDays;

    let adjCloseValidation = null;
    if (latestPast?.execution_date && latestPast?.ratio_factor) {
      try {
        adjCloseValidation = await validateAdjCloseAroundSplit(
          ticker,
          latestPast.execution_date,
          latestPast.ratio_factor
        );
      } catch (valErr) {
        console.warn('[splits] adj_close validation failed:', valErr?.message || valErr);
      }
    }

    const payload = {
      ticker,
      has_split: Boolean(latestPast || upcoming),
      is_recent: isRecent,
      is_upcoming: isUpcoming,
      days_since_split: ageDays,
      days_until_split: untilDays,
      latest,
      latest_past: latestPast,
      upcoming,
      recent_splits: recent,
      adj_close_validation: adjCloseValidation,
      cache_hit: false
    };
    await setCache(cacheKey, payload, SPLITS_CACHE_TTL_SECS);
    res.set('X-Cache-Hit', '0');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[splits] ticker summary error:', err);
    res.status(500).json({ error: 'Failed to fetch ticker split summary' });
  }
}

/** GET /api/splits/status */
async function getSplitSyncStatus(req, res) {
  try {
    const state = await getSyncState();
    res.status(200).json({
      enabled: Boolean(process.env.MASSIVE_API_KEY),
      last_execution_date: state?.last_execution_date?.value || state?.last_execution_date || null,
      last_run_at: state?.last_run_at?.value || state?.last_run_at || null,
      last_new_count: state?.last_new_count != null ? Number(state.last_new_count) : null,
      last_total_fetched: state?.last_total_fetched != null ? Number(state.last_total_fetched) : null
    });
  } catch (err) {
    console.error('[splits] status error:', err);
    res.status(500).json({ error: 'Failed to fetch split sync status' });
  }
}

/** POST /api/splits/sync — manual refresh (auth required) */
async function postSplitSync(req, res) {
  try {
    const info = await runSplitSync();
    if (info.skipped) {
      return res.status(503).json({ error: info.reason || 'Split sync unavailable' });
    }
    const paperAdj = await runPaperSplitAdjustmentJob();
    res.status(200).json({ success: true, ...info, paper_adjustments: paperAdj });
  } catch (err) {
    console.error('[splits] sync error:', err);
    res.status(500).json({ error: err?.message || 'Split sync failed' });
  }
}

/** GET /api/splits/paper-adjust/status */
async function getPaperSplitAdjustStatus(req, res) {
  try {
    const state = await getAdjustmentState();
    const recent = await listRecentPaperAdjustments(25);
    res.status(200).json({
      enabled: process.env.ENABLE_PAPER_SPLIT_ADJUST !== '0',
      last_processed_date: state?.last_processed_date || null,
      last_run_at: state?.last_run_at || null,
      last_adjustments_count:
        state?.last_adjustments_count != null ? Number(state.last_adjustments_count) : null,
      recent_adjustments: recent
    });
  } catch (err) {
    console.error('[splits] paper-adjust status error:', err);
    res.status(500).json({ error: 'Failed to fetch paper split adjustment status' });
  }
}

/** POST /api/splits/paper-adjust — manual paper lot/order adjustment run */
async function postPaperSplitAdjust(req, res) {
  try {
    const forceFrom = req.body?.force_from || req.query?.force_from || null;
    const info = await runPaperSplitAdjustmentJob({ forceFrom });
    if (info.skipped) {
      return res.status(503).json({ error: info.reason || 'Paper split adjustment unavailable' });
    }
    res.status(200).json({ success: true, ...info });
  } catch (err) {
    console.error('[splits] paper-adjust error:', err);
    res.status(500).json({ error: err?.message || 'Paper split adjustment failed' });
  }
}

module.exports = {
  getRecentSplits,
  getSplits,
  getTickerSplitSummary,
  getSplitSyncStatus,
  postSplitSync,
  getPaperSplitAdjustStatus,
  postPaperSplitAdjust
};
