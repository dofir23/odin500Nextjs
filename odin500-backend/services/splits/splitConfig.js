const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'extended-byway-454621-s6';
const DATASET = process.env.BIGQUERY_DATASET || 'sp500data1';
const SPLITS_TABLE = process.env.BIGQUERY_SPLITS_TABLE || 'stock_splits';
const SYNC_STATE_TABLE = process.env.BIGQUERY_SPLITS_SYNC_STATE_TABLE || 'stock_splits_sync_state';

const MASSIVE_API_BASE = (process.env.MASSIVE_API_BASE || 'https://api.massive.com').replace(/\/$/, '');

/** First sync backfill window when no state exists. */
const DEFAULT_INITIAL_SYNC_YEARS = Number(process.env.SPLITS_INITIAL_SYNC_YEARS || 10);

function getMassiveApiKey() {
  return process.env.MASSIVE_API_KEY || '';
}

function getSplitsTableFqn() {
  return `\`${PROJECT_ID}.${DATASET}.${SPLITS_TABLE}\``;
}

function getSyncStateTableFqn() {
  return `\`${PROJECT_ID}.${DATASET}.${SYNC_STATE_TABLE}\``;
}

module.exports = {
  PROJECT_ID,
  DATASET,
  SPLITS_TABLE,
  SYNC_STATE_TABLE,
  get SPLITS_TABLE_FQN() {
    return getSplitsTableFqn();
  },
  get SYNC_STATE_TABLE_FQN() {
    return getSyncStateTableFqn();
  },
  MASSIVE_API_BASE,
  getMassiveApiKey,
  DEFAULT_INITIAL_SYNC_YEARS
};
