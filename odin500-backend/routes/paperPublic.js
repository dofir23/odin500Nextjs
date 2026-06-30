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

router.get('/portfolios', async (req, res) => {
  try {
    const portfolios = await listPublishedPortfolios();
    res.status(200).json({ success: true, portfolios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load portfolios' });
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
