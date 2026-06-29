const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const {
  getRecentSplits,
  getSplits,
  getTickerSplitSummary,
  getSplitSyncStatus,
  postSplitSync,
  getPaperSplitAdjustStatus,
  postPaperSplitAdjust
} = require('../controllers/splitsController');

router.get('/recent', requireAuth, getRecentSplits);
router.get('/status', requireAuth, getSplitSyncStatus);
router.get('/paper-adjust/status', requireAuth, getPaperSplitAdjustStatus);
router.post('/paper-adjust', requireAuth, postPaperSplitAdjust);
router.get('/ticker/:symbol', requireAuth, getTickerSplitSummary);
router.get('/', requireAuth, getSplits);
router.post('/sync', requireAuth, postSplitSync);

module.exports = router;
