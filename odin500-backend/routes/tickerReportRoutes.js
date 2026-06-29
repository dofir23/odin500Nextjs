const express = require('express');
const { getTickerReport } = require('../controllers/tickerReportController');

const router = express.Router();

router.get('/ticker/:symbol', getTickerReport);

module.exports = router;
