const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'extended-byway-454621-s6';
const DATASET = process.env.BIGQUERY_DATASET || 'sp500data1';
const STANCE_TABLE = process.env.BIGQUERY_TICKER_AI_STANCE_TABLE || 'ticker_ai_stance';

/** Same signal + price sources the ticker chart reads, so the AI sees what the user sees. */
const OHLC_TABLE_FQN = `\`${PROJECT_ID}.${DATASET}.${process.env.BIGQUERY_TABLE || 'stock_all_data'}\``;
const OHLC_SIGNALS_TABLE_FQN =
  process.env.OHLC_SIGNALS_TABLE_FQN || '`extended-byway-454621-s6.sp500data1.Test`';
const MA200_TABLE_FQN =
  process.env.MA200_TABLE_FQN || '`extended-byway-454621-s6.sp500data1.200MA_consolidated`';

/**
 * Engines polled for a stance, in card row order. Any without an API key configured are reported
 * as unavailable rather than failing the request, so a row still renders with nothing highlighted.
 */
const STANCE_ENGINES = ['claude', 'chatgpt', 'gemini'];

/** Trading days of history summarised into the prompt. */
const CONTEXT_LOOKBACK_DAYS = Math.min(
  Math.max(Number(process.env.TICKER_AI_STANCE_LOOKBACK_DAYS || 90), 30),
  365
);

const VALID_STANCES = new Set(['long', 'short', 'neutral']);

module.exports = {
  PROJECT_ID,
  DATASET,
  STANCE_TABLE,
  get STANCE_TABLE_FQN() {
    return `\`${PROJECT_ID}.${DATASET}.${STANCE_TABLE}\``;
  },
  OHLC_TABLE_FQN,
  OHLC_SIGNALS_TABLE_FQN,
  MA200_TABLE_FQN,
  STANCE_ENGINES,
  CONTEXT_LOOKBACK_DAYS,
  VALID_STANCES
};
