const express = require('express');
const { requireAuthStrict } = require('../middleware/authMiddleware');
const {
  getSubscribeStatus,
  postSubscribe,
  deleteSubscribe
} = require('../controllers/newsletterSubscriptionController');

const router = express.Router();

router.get('/subscribe/status', requireAuthStrict, getSubscribeStatus);
router.post('/subscribe', requireAuthStrict, postSubscribe);
router.delete('/subscribe', requireAuthStrict, deleteSubscribe);

module.exports = router;
