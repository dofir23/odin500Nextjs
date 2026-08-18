const { getTickerAiStance } = require('../services/ai/tickerStance');

/**
 * GET /api/market/ticker-ai-stance?ticker=AAPL
 *
 * Auth-gated on purpose: the handler can trigger paid model calls, and every ticker page already
 * requires a session for its market data. Leaving it open would let the SEO crawlers in
 * next.config.ts's allowlist bill a round of LLM calls per symbol they walk.
 */
const getTickerAiStanceHandler = async (req, res) => {
  const ticker = String(req.query?.ticker || '').trim();
  if (!ticker) {
    return res.status(400).json({ success: false, error: 'Missing required query param: ticker' });
  }
  if (!/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return res.status(400).json({ success: false, error: 'Invalid ticker' });
  }

  try {
    const payload = await getTickerAiStance(ticker);
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ success: false, error: error.message || 'Failed to load AI stance' });
  }
};

module.exports = { getTickerAiStanceHandler };
