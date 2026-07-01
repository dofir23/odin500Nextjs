const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuthStrict, requireAdmin } = require('../middleware/authMiddleware');
const { isUserAdmin, getUserProfile } = require('../services/admin/adminAuth');
const adminService = require('../services/admin/adminService');

const router = express.Router();

const adminMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many admin actions, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Any logged-in user — returns admin flag without requiring admin role */
router.get('/me', requireAuthStrict, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.user.id);
    const profile = isAdmin ? await getUserProfile(req.user.id) : null;
    res.status(200).json({
      isAdmin,
      displayName: profile?.display_name || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load admin status' });
  }
});

router.use(requireAdmin);

router.get('/overview', async (req, res) => {
  try {
    const overview = await adminService.getOverview();
    res.status(200).json({ success: true, overview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load overview' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const payload = await adminService.listUsers({
      page: req.query.page,
      perPage: req.query.per_page || req.query.perPage,
      search: req.query.search
    });
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load users' });
  }
});

router.get('/users/:userId', async (req, res) => {
  try {
    const detail = await adminService.getUserDetail(req.params.userId);
    res.status(200).json({ success: true, ...detail });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to load user' });
  }
});

router.patch('/users/:userId/plan', adminMutationLimiter, async (req, res) => {
  try {
    const profile = await adminService.updateUserPlan(req.user.id, req.params.userId, req.body || {});
    res.status(200).json({ success: true, profile });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to update plan' });
  }
});

router.patch('/users/:userId/admin', adminMutationLimiter, async (req, res) => {
  try {
    const isAdmin = Boolean(req.body?.is_admin ?? req.body?.isAdmin);
    const profile = await adminService.setUserAdmin(req.user.id, req.params.userId, isAdmin);
    res.status(200).json({ success: true, profile });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to update admin status' });
  }
});

router.delete('/users/:userId/newsletter', adminMutationLimiter, async (req, res) => {
  try {
    const subscription = await adminService.adminUnsubscribeNewsletter(req.user.id, req.params.userId);
    res.status(200).json({ success: true, subscription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to unsubscribe user' });
  }
});

router.delete('/users/:userId', adminMutationLimiter, async (req, res) => {
  try {
    const result = await adminService.adminDeleteUser(req.user.id, req.params.userId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to delete user' });
  }
});

router.delete('/users/:userId/portfolios/:accountId', adminMutationLimiter, async (req, res) => {
  try {
    const result = await adminService.adminDeletePortfolio(
      req.user.id,
      req.params.userId,
      req.params.accountId
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to delete portfolio' });
  }
});

router.delete('/users/:userId/watchlists/:watchlistId', adminMutationLimiter, async (req, res) => {
  try {
    const result = await adminService.adminDeleteWatchlist(
      req.user.id,
      req.params.userId,
      req.params.watchlistId
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to delete watchlist' });
  }
});

router.get('/content/portfolios', async (req, res) => {
  try {
    const portfolios = await adminService.listPublishedPortfolios();
    res.status(200).json({ success: true, portfolios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load portfolios' });
  }
});

router.patch('/portfolios/:accountId/unpublish', adminMutationLimiter, async (req, res) => {
  try {
    const account = await adminService.adminUnpublishPortfolio(req.user.id, req.params.accountId);
    res.status(200).json({ success: true, account });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to unpublish' });
  }
});

router.get('/content/newsletters', async (req, res) => {
  try {
    const issues = await adminService.listNewsletterIssuesAdmin();
    res.status(200).json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load newsletters' });
  }
});

router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await adminService.listAllSubscribersAdmin({
      limit: req.query.limit
    });
    res.status(200).json({ success: true, subscribers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load subscribers' });
  }
});

module.exports = router;
