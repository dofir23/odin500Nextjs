const express = require('express');
const router = express.Router();
const {
  listPublishedPortfolios,
  getPublishedPortfolioDetail,
  getPublishedPortfolioHistory,
  getPublishedClosedTrades,
  getPublishedSectorAllocation,
  getPublishedOrders,
  getPublishedRebalances,
  getPublishedStrategy
} = require('../services/paper/publicPortfolio');
const { queryPublishedPortfolios } = require('../services/paper/publicPortfolioQuery');
const { buildCopyPreview } = require('../services/paper/copyPortfolio');
const { generatePortfolioSummaries } = require('../services/paper/portfolioSummaryAi');
const {
  buildPortfolioExportWorkbook,
  buildAiPortfolioTemplateWorkbook
} = require('../services/paper/portfolioExport');

/**
 * Published portfolios. Supports server-side filter/sort/pagination via query params:
 *   ?page=1&page_size=10&sort=total_return_pct&dir=desc&ai_only=1&engine=claude&index=dow&direction=short
 * Without any of those params it returns the full list unchanged, so existing callers
 * (the public gallery, the homepage teaser) keep working as-is.
 */
const PAGINATION_PARAMS = [
  'page',
  'page_size',
  'sort',
  'dir',
  'ai_only',
  'engine',
  'index',
  'direction',
  'owner'
];

router.get('/portfolios', async (req, res) => {
  try {
    const all = await listPublishedPortfolios();
    const ttl = Number(process.env.PUBLIC_PORTFOLIOS_CACHE_TTL_SECS || 300);
    if (ttl > 0) {
      res.set('Cache-Control', `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}`);
    }

    const wantsPaged = PAGINATION_PARAMS.some((k) => req.query[k] != null);
    if (!wantsPaged) {
      return res.status(200).json({ success: true, portfolios: all });
    }

    const { portfolios, pagination, facets } = queryPublishedPortfolios(all, req.query);
    res.status(200).json({ success: true, portfolios, pagination, facets });
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

router.get('/portfolios/:accountId/rebalances', async (req, res) => {
  try {
    const rebalances = await getPublishedRebalances(req.params.accountId);
    res.status(200).json({ success: true, rebalances });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load rebalances' });
  }
});

/** Blank .xlsx the user fills in to create an AI portfolio without going through the chat
 *  wizard. Contains no user data, so it's served publicly and downloads via a plain link. */
router.get('/ai-portfolio-template.xlsx', async (req, res) => {
  try {
    const { workbook, filename } = buildAiPortfolioTemplateWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to build template' });
  }
});

router.get('/portfolios/:accountId/export.xlsx', async (req, res) => {
  try {
    const { workbook, filename } = await buildPortfolioExportWorkbook(req.params.accountId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to export portfolio' });
  }
});

/**
 * What a visitor would receive if they copied this portfolio right now.
 *
 * Deliberately unauthenticated: an anonymous visitor should see the concrete share counts
 * before being asked to sign up. Reads published data only and creates nothing.
 */
router.get('/portfolios/:accountId/copy-preview', async (req, res) => {
  try {
    const preview = await buildCopyPreview({ accountId: req.params.accountId });
    res.status(200).json({ success: true, ...preview });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Failed to build copy preview',
      code: error.code || undefined
    });
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
