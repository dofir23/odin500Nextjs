-- BigQuery: per-day, per-engine AI long/short stance on a ticker.
-- Backs the "AI Signal" card on the ticker page (services/ai/tickerStance.js).
-- Run in dataset sp500data1 (or your BIGQUERY_DATASET).
-- The table is also auto-created on first use via services/ai/tickerStanceStore.js.

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.ticker_ai_stance` (
  ticker STRING NOT NULL,
  stance_date DATE NOT NULL,      -- America/New_York market day
  engine STRING NOT NULL,         -- 'claude' | 'chatgpt' | 'gemini'
  stance STRING NOT NULL,         -- 'long' | 'short' | 'neutral'
  rationale STRING,               -- one-sentence model justification, truncated to 1000 chars
  model STRING,                   -- resolved model id at the time of the call
  created_at TIMESTAMP NOT NULL
)
PARTITION BY stance_date
CLUSTER BY ticker, engine;

-- Reads filter on (ticker, stance_date) and take the newest row per engine, so a retry after a
-- partial failure can append instead of updating a row still in the streaming buffer.

-- Env (odin500-backend/.env):
-- BIGQUERY_TICKER_AI_STANCE_TABLE=ticker_ai_stance   -- optional override
-- TICKER_AI_STANCE_LOOKBACK_DAYS=90                  -- history summarised into the prompt
-- At least one of OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY must be set;
-- engines without a key are reported as unavailable rather than failing the request.

-- Cost control: one round of calls per ticker per market day, shared by all viewers.
-- To purge a day and force a re-ask:
--   DELETE FROM `extended-byway-454621-s6.sp500data1.ticker_ai_stance`
--   WHERE stance_date = CURRENT_DATE('America/New_York') AND ticker = 'AAPL';
