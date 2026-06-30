const express = require('express');
const { requireAuthStrict } = require('../middleware/authMiddleware');
const {
  listNotifications,
  getUnreadCount,
  patchMarkRead,
  patchMarkAllRead
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', requireAuthStrict, listNotifications);
router.get('/unread-count', requireAuthStrict, getUnreadCount);
router.patch('/read-all', requireAuthStrict, patchMarkAllRead);
router.patch('/:id/read', requireAuthStrict, patchMarkRead);

module.exports = router;
