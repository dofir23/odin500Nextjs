const PROJECT_ID =
  process.env.GCP_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'extended-byway-454621-s6';
const DATASET = process.env.BIGQUERY_DATASET || 'sp500data1';
const NEWSLETTER_TABLE = process.env.BIGQUERY_NEWSLETTER_TABLE || 'weekly_newsletter';

const NEWSLETTER_TABLE_FQN = `${PROJECT_ID}.${DATASET}.${NEWSLETTER_TABLE}`;

module.exports = {
  PROJECT_ID,
  DATASET,
  NEWSLETTER_TABLE,
  NEWSLETTER_TABLE_FQN
};
