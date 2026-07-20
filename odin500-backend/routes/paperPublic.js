const express = require('express');
const router = express.Router();
const {
  listPublishedPortfolios,
  getPublishedPortfolioDetail,
  getPublishedPortfolioHistory,
  getPublishedClosedTrades,
  getPublishedSectorAllocation,
  getPublishedOrders,
  getPublishedStrategy
} = require('../services/paper/publicPortfolio');
const { generatePortfolioSummaries } = require('../services/paper/portfolioSummaryAi');

router.get('/portfolios', async (req, res) => {
  try {
    const portfolios = await listPublishedPortfolios();
    const ttl = Number(process.env.PUBLIC_PORTFOLIOS_CACHE_TTL_SECS || 300);
    if (ttl > 0) {
      res.set('Cache-Control', `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}`);
    }
    res.status(200).json({ success: true, portfolios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load portfolios' });
  }
});

/** Batch AI (or fallback) summaries for top public portfolio cards. */
router.post('/portfolios/ai-summaries', async (req, res) => {
  try {
    const portfolios = Array.isArray(req.body?.portfolios) ? req.body.portfolios.slice(0, 6) : [];
    if (!portfolios.length) {
      return res.status(400).json({ success: false, error: 'portfolios array required' });
    }
    const result = await generatePortfolioSummaries(portfolios);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate summaries' });
  }
});

router.get('/portfolios/:accountId', async (req, res) => {
  try {
    const portfolio = await getPublishedPortfolioDetail(req.params.accountId);
    res.status(200).json({ success: true, portfolio });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load portfolio' });
  }
});

router.get('/portfolios/:accountId/history', async (req, res) => {
  try {
    const history = await getPublishedPortfolioHistory(req.params.accountId);
    res.status(200).json({ success: true, history });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load history' });
  }
});

router.get('/portfolios/:accountId/closed-trades', async (req, res) => {
  try {
    const payload = await getPublishedClosedTrades(req.params.accountId);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load closed trades' });
  }
});

router.get('/portfolios/:accountId/sectors', async (req, res) => {
  try {
    const payload = await getPublishedSectorAllocation(req.params.accountId);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load sectors' });
  }
});

router.get('/portfolios/:accountId/orders', async (req, res) => {
  try {
    const orders = await getPublishedOrders(req.params.accountId);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load orders' });
  }
});

router.get('/portfolios/:accountId/strategy', async (req, res) => {
  try {
    const payload = await getPublishedStrategy(req.params.accountId);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load strategy' });
  }
});

module.exports = router;
