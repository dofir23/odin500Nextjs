const { buildTickerReport } = require('../services/tickerReportGenerator');

async function getTickerReport(req, res) {
  const symbol = String(req.params.symbol || '').trim().toUpperCase();
  if (!symbol) {
    return res.status(400).json({ success: false, error: 'Missing ticker symbol' });
  }

  const year = Number(req.query.year);
  const month = Number(req.query.month);

  try {
    const report = await buildTickerReport(symbol, { year, month });
    return res.json({ success: true, report });
  } catch (error) {
    console.error('[ticker-report] failed:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate ticker report'
    });
  }
}

module.exports = { getTickerReport };
